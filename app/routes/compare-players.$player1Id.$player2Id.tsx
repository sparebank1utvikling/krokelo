import { type MetaFunction, type LoaderFunctionArgs } from '@remix-run/node';
import { useNavigate } from '@remix-run/react';
import { PlayerWithStats, getPlayers } from '../services/player-service';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import Select, { createFilter } from 'react-select';
import { PageContainerStyling } from './team-duel';
import { BASE_ELO } from '../utils/constants';

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
  const player1Id = parseInt(params.player1Id || '0', 10);
  const player2Id = parseInt(params.player2Id || '0', 10);

  const players = await getPlayers();
  const player1 = players.find((player) => player.id === player1Id);
  const player2 = players.find((player) => player.id === player2Id);

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

  const player1WinStats =
    player1 && player2 ? findPlayerWinStats(player1, player2) : undefined;

  return typedjson({ playerOptions, player1, player2, player1WinStats });
};

const findPlayerWinStats = (
  player: PlayerWithStats,
  playerToCompareTo: PlayerWithStats
) => {
  const playerMatches = player.matchesAsWinner.concat(player.matchesAsLoser);

  const allMatchesBetweenPlayers = playerMatches.filter(
    (match) =>
      match.winnerId === playerToCompareTo.id ||
      match.loserId === playerToCompareTo.id
  );
  const matchesWonByPlayer = allMatchesBetweenPlayers.filter(
    (match) => match.winnerId === player.id
  );
  const numberOfMatches = allMatchesBetweenPlayers.length;
  const numberOfMatchesWonByPlayer = matchesWonByPlayer.length;
  const numberOfMatchesLostByPlayer =
    numberOfMatches - numberOfMatchesWonByPlayer;
  const winPercentage = (numberOfMatchesWonByPlayer / numberOfMatches) * 100;

  return {
    numberOfMatches,
    numberOfMatchesWonByPlayer,
    numberOfMatchesLostByPlayer,
    winPercentage,
  };
};

const findMatchesBetweenPlayers = (
  player1: PlayerWithStats,
  player2: PlayerWithStats
) => {
  const sortedLogs = [...player1.eloLogs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const allMatches = [...player1.matchesAsWinner, ...player1.matchesAsLoser]
    .filter(
      (match) =>
        (match.winnerId === player1.id && match.loserId === player2.id) ||
        (match.winnerId === player2.id && match.loserId === player1.id)
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((match) => {
      const matchLog = sortedLogs.find((log) => log.matchId === match.id);

      let eloDiff = 0;
      let player1Elo = BASE_ELO;
      let player2Elo = BASE_ELO;

      if (matchLog) {
        const matchIndex = sortedLogs.indexOf(matchLog);
        const previousElo =
          matchIndex === 0 ? BASE_ELO : sortedLogs[matchIndex - 1].elo;
        eloDiff = matchLog.elo - previousElo;
        player1Elo = matchLog.elo;
      }

      return {
        ...match,
        eloDiff: match.winnerId === player1.id ? eloDiff : -eloDiff,
        player1Elo,
        player2Elo,
        winner: match.winnerId === player1.id ? player1 : player2,
        loser: match.loserId === player1.id ? player1 : player2,
        accumulatedEloDiff: 0,
      };
    });

  let runningTotal = 0;
  allMatches.reverse().forEach((match) => {
    const matchEloDiff = Math.abs(match.eloDiff);
    runningTotal +=
      match.winner.id === player1.id ? matchEloDiff : -matchEloDiff;
    match.accumulatedEloDiff = runningTotal;
  });
  allMatches.reverse();

  return allMatches;
};

export default function Index() {
  const navigate = useNavigate();
  const { playerOptions, player1, player2, player1WinStats } =
    useTypedLoaderData<typeof loader>();

  const matchHistory =
    player1 && player2 ? findMatchesBetweenPlayers(player1, player2) : [];

  return (
    <div className={PageContainerStyling}>
      <div className="flex justify-center py-4">
        <Select
          id="player1CompareSelect"
          value={playerOptions.find((p) => p.value === player1?.id)}
          className="basis-2/3 md:basis-1/3 dark:text-black"
          placeholder="Velg spiller 1"
          isClearable
          options={playerOptions}
          filterOption={(option, rawInput) =>
            createFilter()(option, rawInput) &&
            Number(option.value) !== player2?.id
          }
          onChange={(option) => {
            navigate(
              `/compare-players/${option?.value ?? 0}/${player2?.id ?? 0}`
            );
          }}
        />
        <Select
          id="player2CompareSelect"
          value={playerOptions.find((p) => p.value === player2?.id)}
          className="ml-4 basis-2/3 md:basis-1/3 dark:text-black"
          placeholder="Velg spiller 2"
          isClearable
          options={playerOptions}
          filterOption={(option, rawInput) =>
            createFilter()(option, rawInput) &&
            Number(option.value) !== player1?.id
          }
          onChange={(option) => {
            navigate(
              `/compare-players/${player1?.id ?? 0}/${option?.value ?? 0}`
            );
          }}
        />
      </div>

      {player1 && player2 && (
        <div className="container flex flex-col justify-center">
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            Sammenligning {player1.name} vs {player2.name}
          </h2>
          <div className="grid grid-cols-4 gap-4 rounded-lg bg-white p-6 pr-8 shadow-lg dark:bg-gray-800">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {player1WinStats?.numberOfMatches}
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Kamper
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {player1WinStats?.numberOfMatchesWonByPlayer}
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Seiere
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {player1WinStats?.numberOfMatchesLostByPlayer}
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Tap
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {player1WinStats?.winPercentage
                  ? player1WinStats.winPercentage.toFixed(1)
                  : 0}
                %
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Win rate
              </div>
            </div>
          </div>

          <h2 className="mb-4 mt-8 text-2xl font-bold text-gray-900 dark:text-white">
            Kamphistorikk 📋
          </h2>
          <div className="overflow-x-auto rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
            <table className="min-w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="py-2 text-left text-gray-900 dark:text-white">
                    Dato
                  </th>
                  <th className="py-2 text-left text-gray-900 dark:text-white">
                    Vinner
                  </th>
                  <th className="py-2 text-left text-gray-900 dark:text-white">
                    Taper
                  </th>
                  <th className="py-2 text-right text-gray-900 dark:text-white">
                    ELO
                  </th>
                  <th className="py-2 text-right text-gray-900 dark:text-white">
                    ELO totalt
                  </th>
                </tr>
              </thead>
              <tbody>
                {matchHistory.map((match) => (
                  <tr key={match.id} className="border-b dark:border-gray-700">
                    <td className="py-2 text-gray-900 dark:text-white">
                      {new Date(match.date).toLocaleString('no-NO', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                      })}
                    </td>
                    <td className="py-2 font-semibold text-gray-900 dark:text-white">
                      {match.winner.name}{' '}
                      <span className="font-normal text-gray-600 dark:text-gray-400">
                        (
                        {match.winner.id === player1.id
                          ? match.player1Elo
                          : match.player2Elo}
                        )
                      </span>
                    </td>
                    <td className="py-2 font-semibold text-gray-900 dark:text-white">
                      {match.loser.name}{' '}
                      <span className="font-normal text-gray-600 dark:text-gray-400">
                        (
                        {match.loser.id === player1.id
                          ? match.player1Elo
                          : match.player2Elo}
                        )
                      </span>
                    </td>
                    <td
                      className={`py-2 text-right font-semibold ${
                        match.winner.id === player1.id
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {match.winner.id === player1.id ? '+' : '-'}
                      {Math.abs(match.eloDiff)}
                    </td>
                    <td
                      className={`py-2 text-right font-semibold ${
                        match.accumulatedEloDiff > 0
                          ? 'text-green-600 dark:text-green-400'
                          : match.accumulatedEloDiff < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {match.accumulatedEloDiff > 0 ? '+' : ''}
                      {match.accumulatedEloDiff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
