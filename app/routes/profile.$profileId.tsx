import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
} from '@remix-run/node';
import { Form, useNavigate, useSubmit } from '@remix-run/react';
import { EloHistoryChart } from '~/components/elo-history-charts';
import { getPlayers, updatePlayerStatus } from '~/services/player-service';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import Select from 'react-select';
import { PageContainerStyling } from './team-duel';
import { BASE_ELO } from '~/utils/constants';

export const meta: MetaFunction = () => {
  return [
    { title: 'SB1U Krok Champions' },
    {
      property: 'og:title',
      content: 'SB1U Krokinole Champions',
    },
    {
      name: 'description',
      content: 'Her kan du registrere resultater fra SB1U Krokinolekamper.',
    },
  ];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const playerId = parseInt(params.profileId || '0', 10);

  const players = await getPlayers();
  const player = players.find((player) => player.id === playerId);

  return typedjson({ players, player });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const playerId = parseInt(formData.get('playerId') as string, 10);
  const inactive = formData.get('inactive') === 'on';
  await updatePlayerStatus(playerId, inactive);

  return redirect(`/profile/${playerId}`);
};

interface Match {
  id: number;
  date: Date;
  winnerId: number;
  loserId: number;
}

const calculatePlayerMatchups = (
  player: {
    matchesAsWinner: Match[];
    matchesAsLoser: Match[];
    id: number;
    eloLogs: { date: Date; elo: number; matchId: number }[];
  },
  allPlayers: { id: number; name: string }[]
) => {
  const opponents = new Map<
    number,
    {
      eloDiff: number;
      name: string;
      matches: number;
      wins: number;
      losses: number;
    }
  >();

  const sortedLogs = [...player.eloLogs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Process matches and calculate actual ELO changes
  [...player.matchesAsWinner, ...player.matchesAsLoser].forEach((match) => {
    const opponentId =
      match.winnerId === player.id ? match.loserId : match.winnerId;
    const isWin = match.winnerId === player.id;
    const matchLog = sortedLogs.find((log) => log.matchId === match.id);
    if (!matchLog) return;

    const matchIndex = sortedLogs.indexOf(matchLog);
    const previousElo =
      matchIndex === 0 ? BASE_ELO : sortedLogs[matchIndex - 1].elo;
    const eloDiff = matchLog.elo - previousElo;

    const current = opponents.get(opponentId) || {
      eloDiff: 0,
      matches: 0,
      name: '',
      wins: 0,
      losses: 0,
    };

    opponents.set(opponentId, {
      ...current,
      eloDiff: current.eloDiff + eloDiff,
      matches: current.matches + 1,
      wins: current.wins + (isWin ? 1 : 0),
      losses: current.losses + (isWin ? 0 : 1),
    });
  });

  // Find best and worst matchups
  let bestMatchup = {
    name: '',
    eloDiff: -Infinity,
    matches: 0,
    wins: 0,
    losses: 0,
  };
  let worstMatchup = {
    name: '',
    eloDiff: Infinity,
    matches: 0,
    wins: 0,
    losses: 0,
  };
  let mostPlayedAgainst = {
    name: '',
    eloDiff: 0,
    matches: 0,
    wins: 0,
    losses: 0,
  };

  opponents.forEach((stats, opponentId) => {
    const opponent = allPlayers.find((p) => p.id === opponentId);
    if (!opponent) return;

    stats.name = opponent.name;
    if (stats.matches >= 1) {
      if (stats.eloDiff > bestMatchup.eloDiff) {
        bestMatchup = stats;
      }
      if (stats.eloDiff < worstMatchup.eloDiff) {
        worstMatchup = stats;
      }
      if (stats.matches > mostPlayedAgainst.matches) {
        mostPlayedAgainst = stats;
      }
    }
  });

  return { bestMatchup, worstMatchup, mostPlayedAgainst };
};

export default function Index() {
  const navigate = useNavigate();
  const { players, player } = useTypedLoaderData<typeof loader>();
  const submit = useSubmit();
  const playersSortedOnELODesc = [...players]
    .filter((player) => !player.inactive)
    .sort((p1, p2) => p2.currentELO - p1.currentELO);

  const playersSortedOnTeamELODesc = [...players]
    .filter((player) => !player.inactive)
    .sort((p1, p2) => p2.currentTeamELO - p1.currentTeamELO);

  const playerOptions = players
    .sort((a, b) => {
      // Sort inactive players to the bottom
      if (a.inactive && !b.inactive) return 1;
      if (!a.inactive && b.inactive) return -1;
      // Then sort by number of games
      const aGames = a.matchesAsWinner.length + a.matchesAsLoser.length;
      const bGames = b.matchesAsWinner.length + b.matchesAsLoser.length;
      return bGames - aGames;
    })
    .map((player) => ({
      value: player.id,
      label: `${player.name} (${player.matchesAsWinner.length + player.matchesAsLoser.length} kamper)${player.inactive ? ' ❌' : ''}`,
    }));

  const numberOfWins = player ? player.matchesAsWinner.length : 0;
  const numberOfLosses = player ? player.matchesAsLoser.length : 0;
  const numberOfMatches = numberOfWins + numberOfLosses;
  const winPercentage = (numberOfWins / numberOfMatches) * 100;

  interface EloLog {
    elo: number;
  }

  const findLongestWinStreak = (eloLogs: EloLog[]): number => {
    if (eloLogs.length === 0) return 0;

    const logs = [...eloLogs].reverse();
    let longestWinStreak = 0;
    let currentWinStreak = 0;
    logs[0].elo > 1500 && (currentWinStreak = 1);
    for (let i = 1; i < logs.length; i++) {
      if (logs[i].elo > logs[i - 1].elo) {
        currentWinStreak++;
      } else {
        if (currentWinStreak > longestWinStreak) {
          longestWinStreak = currentWinStreak;
        }
        currentWinStreak = 0;
      }
    }

    // Final check in case the longest streak is at the end
    if (currentWinStreak > longestWinStreak) {
      longestWinStreak = currentWinStreak;
    }

    return longestWinStreak;
  };

  const matchups = player ? calculatePlayerMatchups(player, players) : null;

  return (
    <div className={PageContainerStyling}>
      <div className="flex justify-center py-4">
        <Select
          id="playerProfileSelect"
          value={playerOptions.find((p) => p.value === player?.id)}
          className="basis-2/3 md:basis-1/3 dark:text-black"
          placeholder="Velg spiller"
          isClearable
          options={playerOptions}
          onChange={(option) => {
            navigate(`/profile/${option ? option.value : 0}`);
          }}
        />
      </div>

      {player && (
        <div>
          <ul className="mb-2 flex-col items-center space-y-2 rounded-lg bg-blue-100 p-4 text-center text-lg text-black shadow-lg dark:bg-gray-700 dark:text-white">
            <li className="text-4xl">{player.name}</li>
            <li>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  Rating duellspill:{' '}
                  <span className="font-bold dark:text-green-200">
                    {player.currentELO}
                  </span>
                </div>
                <div>
                  Rating lagspill:{' '}
                  <span className="font-bold dark:text-green-200">
                    {player.currentTeamELO}
                  </span>
                </div>
              </div>
            </li>
            <li>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  Høyeste rating duellspill 🏔️:{' '}
                  <span className="font-bold dark:text-green-200">
                    {Math.max(1500, ...player.eloLogs.map((log) => log.elo))}
                  </span>
                </div>
                <div>
                  Høyeste rating lagspill 🏔️:{' '}
                  <span className="font-bold dark:text-green-200">
                    {Math.max(
                      1500,
                      ...player.teamPlayerELOLog.map((log) => log.elo)
                    )}
                  </span>
                </div>
                <div>
                  Lengste win streak - duell 🔥:{' '}
                  <span className="font-bold dark:text-green-200">
                    {findLongestWinStreak(player.eloLogs)}
                  </span>
                </div>
                <div>
                  Lengste win streak - lag 🔥:{' '}
                  <span className="font-bold dark:text-green-200">
                    {findLongestWinStreak(player.teamPlayerELOLog)}
                  </span>
                </div>
              </div>
            </li>
            <div className="grid gap-2 md:grid-cols-2">
              {!player.inactive && (
                <li className="flex items-center justify-center space-x-2 text-center">
                  <span className="flex text-lg">
                    {playersSortedOnELODesc.findIndex(
                      (p) => p.id === player.id
                    ) < 5 && (
                      <div className="group">
                        <img
                          src="/img/medal.png"
                          alt="Medalje for topp 5 plassering"
                          className="mr-2 h-8 w-8"
                        />
                        <span
                          className="text-md absolute bottom-full left-1/2 hidden -translate-x-1/2 translate-y-1 transform
                    rounded bg-black px-2 py-1 pb-1 text-white opacity-0 transition-opacity duration-300 group-hover:block group-hover:opacity-100"
                        >
                          Medalje for topp 5 plassering
                        </span>
                      </div>
                    )}
                    Rangering duellspill:{' '}
                    <span className="ml-2 font-bold dark:text-blue-200">
                      {`${playersSortedOnELODesc.findIndex((p) => p.id === player.id) + 1} / ${playersSortedOnELODesc?.length}`}
                    </span>
                  </span>
                </li>
              )}
              {!player.inactive && (
                <li className="flex items-center justify-center space-x-2">
                  <span className="flex p-2 text-lg">
                    {playersSortedOnTeamELODesc.findIndex(
                      (p) => p.id === player.id
                    ) < 5 && (
                      <div className="group text-center">
                        <img
                          src="/img/medal.png"
                          alt="Medalje for topp 5 plassering"
                          className="mr-2 h-8 w-8"
                        />
                        <span className="text-md absolute bottom-full left-1/2 hidden -translate-x-1/2 translate-y-1 transform rounded bg-black px-2 py-1 pb-1 text-white opacity-0 transition-opacity duration-300 group-hover:block group-hover:opacity-100">
                          Medalje for topp 5 plassering
                        </span>
                      </div>
                    )}
                    Rangering lagspill:{' '}
                    <span className="ml-2 font-bold dark:text-blue-200">
                      {`${playersSortedOnTeamELODesc.findIndex((p) => p.id === player.id) + 1} / ${playersSortedOnTeamELODesc.length}`}
                    </span>
                  </span>
                </li>
              )}
            </div>
            <div className="text-lg">
              Inaktiv spiller:{' '}
              <Form
                method="post"
                action={`/profile/${player.id}`}
                onChange={(e) => submit(e.currentTarget)}
              >
                <input type="hidden" name="playerId" value={player.id} />
                <input
                  type="checkbox"
                  name="inactive"
                  className="form-checkbox h-5 w-5 text-blue-600"
                  checked={player.inactive}
                  onChange={(e) => {
                    submit(e.currentTarget.form);
                  }}
                />
              </Form>
            </div>
          </ul>
          <div className="flex flex-col justify-center">
            <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
              Duellspill Statistikk 📊
            </h2>
            <div className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {numberOfMatches}
                  </div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Kamper
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {numberOfWins}
                  </div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Seiere
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {numberOfLosses}
                  </div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Tap
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {winPercentage ? winPercentage.toFixed(1) : 0}%
                  </div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Win Rate
                  </div>
                </div>
              </div>
              {matchups && matchups.bestMatchup.name && (
                <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-gray-700">
                  {matchups.bestMatchup.eloDiff > 0 && (
                    <div className="rounded-lg bg-gray-50 p-2 text-center dark:bg-gray-700/50">
                      <div className="mb-2 text-base font-semibold text-black dark:text-white">
                        Beste motstander 🏆
                      </div>
                      <div className="mb-1 truncate text-xl font-bold text-black dark:text-white">
                        {matchups.bestMatchup.name}
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        <div>
                          +{Math.round(matchups.bestMatchup.eloDiff)} ELO-poeng
                        </div>
                        <div className="text-black dark:text-white">
                          Kamper: {matchups.bestMatchup.matches} (
                          {matchups.bestMatchup.wins}-
                          {matchups.bestMatchup.losses})
                        </div>
                      </div>
                    </div>
                  )}
                  {matchups.worstMatchup.eloDiff < 0 && (
                    <div className="rounded-lg bg-gray-50 p-2 text-center dark:bg-gray-700/50">
                      <div className="mb-2 text-base font-semibold text-black dark:text-white">
                        Tøffeste motstander 💪
                      </div>
                      <div className="mb-1 truncate text-xl font-bold text-black dark:text-white">
                        {matchups.worstMatchup.name}
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-400">
                        <div>
                          {Math.round(matchups.worstMatchup.eloDiff)} ELO-poeng
                        </div>
                        <div className="text-black dark:text-white">
                          Kamper: {matchups.worstMatchup.matches} (
                          {matchups.worstMatchup.wins}-
                          {matchups.worstMatchup.losses})
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg bg-gray-50 p-2 text-center dark:bg-gray-700/50">
                    <div className="mb-2 text-base font-semibold text-black dark:text-white">
                      Mest spilt mot 🎯
                    </div>
                    <div className="mb-1 truncate text-xl font-bold text-black dark:text-white">
                      {matchups.mostPlayedAgainst.name}
                    </div>
                    <div className="text-sm">
                      <span
                        className={
                          matchups.mostPlayedAgainst.eloDiff > 0
                            ? 'text-green-600 dark:text-green-400'
                            : matchups.mostPlayedAgainst.eloDiff < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }
                      >
                        <div>
                          {matchups.mostPlayedAgainst.eloDiff > 0 ? '+' : ''}
                          {Math.round(matchups.mostPlayedAgainst.eloDiff)}{' '}
                          ELO-poeng
                        </div>
                        <div className="text-black dark:text-white">
                          Kamper: {matchups.mostPlayedAgainst.matches} (
                          {matchups.mostPlayedAgainst.wins}-
                          {matchups.mostPlayedAgainst.losses})
                        </div>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {player.eloLogs.length > 0 && (
            <>
              <h1 className="my-4 text-xl font-bold">
                {player.name} sin ELO-historikk i duellspill
              </h1>
              <EloHistoryChart data={[...player.eloLogs].reverse()} />
            </>
          )}
          {player.teamPlayerELOLog.length > 0 && (
            <>
              <h1 className="my-4 text-xl font-bold">
                {player.name} sin ELO-historikk i lagspill
              </h1>
              <EloHistoryChart data={[...player.teamPlayerELOLog].reverse()} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
