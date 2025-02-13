import { type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useNavigate } from '@remix-run/react';
import { EloHistoryChart } from '~/components/elo-history-charts';
import { getTeams } from '~/services/team-service';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import Select from 'react-select';
import { PageContainerStyling } from './team-duel';
import { BASE_ELO } from '~/utils/constants';

interface TeamMatch {
  id: number;
  date: Date;
  winnerTeamId: number;
  loserTeamId: number;
}

const calculateTeamMatchups = (
  team: {
    teamMatchesAsWinner: TeamMatch[];
    teamMatchesAsLoser: TeamMatch[];
    id: number;
    TeamELOLog: { date: Date; elo: number; teamMatchId: number }[];
  },
  allTeams: { id: number; players: { name: string }[] }[]
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

  const sortedLogs = [...team.TeamELOLog].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  [...team.teamMatchesAsWinner, ...team.teamMatchesAsLoser].forEach((match) => {
    const opponentId =
      match.winnerTeamId === team.id ? match.loserTeamId : match.winnerTeamId;
    const isWin = match.winnerTeamId === team.id;
    const matchLog = sortedLogs.find((log) => log.teamMatchId === match.id);
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
    const opponent = allTeams.find((t) => t.id === opponentId);
    if (!opponent) return;

    stats.name = opponent.players.map((p) => p.name).join(' & ');
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

export const meta: MetaFunction = () => {
  return [
    { title: 'SB1U Krok Champions - Teams' },
    { property: 'og:title', content: 'SB1U Krokinole Champions - Teams' },
    {
      name: 'description',
      content: 'List and stats of all the teams in Krok Champions.',
    },
  ];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const teamId = parseInt(params.teamId || '0', 10);

  const teams = await getTeams();
  const team = teams.find((team) => team.id === teamId);

  return typedjson({ teams, team });
};

export default function Index() {
  const navigate = useNavigate();
  const { teams, team } = useTypedLoaderData<typeof loader>();

  const teamsSortedOnELODesc = [...teams].sort(
    (t1, t2) => t2.currentELO - t1.currentELO
  );
  const topFiveTeamIds = teamsSortedOnELODesc.slice(0, 5).map((t) => t.id);

  const teamOptions = teams
    .sort((a, b) => {
      // Sort teams with inactive players to the bottom
      const aHasInactive = a.players.some((player) => player.inactive);
      const bHasInactive = b.players.some((player) => player.inactive);
      if (aHasInactive && !bHasInactive) return 1;
      if (!aHasInactive && bHasInactive) return -1;
      // Then sort by number of games
      const aMatches =
        a.teamMatchesAsWinner.length + a.teamMatchesAsLoser.length;
      const bMatches =
        b.teamMatchesAsWinner.length + b.teamMatchesAsLoser.length;
      return bMatches - aMatches;
    })
    .map((team) => ({
      value: team.id,
      label: `${team.players.map((p) => p.name).join(' & ')} (${team.teamMatchesAsWinner.length + team.teamMatchesAsLoser.length} kamper)${team.players.some((p) => p.inactive) ? ' ❌' : ''}`,
    }));

  const numberOfWins = team ? team.teamMatchesAsWinner.length : 0;
  const numberOfLosses = team ? team.teamMatchesAsLoser.length : 0;
  const numberOfMatches = numberOfWins + numberOfLosses;
  const winPercentage = (numberOfWins / numberOfMatches) * 100;

  const matchups = team ? calculateTeamMatchups(team, teams) : null;

  return (
    <div className={PageContainerStyling}>
      <div className="flex justify-center py-4">
        <Select
          id="teamProfileSelect"
          value={teamOptions.find((p) => p.value === team?.id)}
          className="basis-2/3 md:basis-1/3 dark:text-black"
          placeholder="Velg lag"
          isClearable
          options={teamOptions}
          onChange={(option) => {
            navigate(`/team-profile/${option ? option.value : 0}`);
          }}
        />
      </div>

      {team && (
        <div>
          <ul className="mb-2 mt-4 flex items-center justify-center space-y-2 rounded-lg bg-blue-100 p-4 text-center text-center text-lg text-black shadow-lg dark:bg-gray-700 dark:text-white">
            <div>
              {topFiveTeamIds.includes(team.id) && (
                <span className="group">
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
                </span>
              )}
            </div>
            <li>
              Rating lagspill:{' '}
              <span className="font-bold dark:text-green-200">
                {team.currentELO}
              </span>
            </li>
          </ul>
          <div className="flex flex-col justify-center">
            <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
              Lagspill Statistikk 📊
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
                    {winPercentage.toFixed(1)}%
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
          {team.TeamELOLog.length > 0 && (
            <>
              <h1 className="my-4 text-xl font-bold">
                {team.name} sin ELO-historikk i lagspill
              </h1>
              <EloHistoryChart data={[...team.TeamELOLog].reverse()} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
