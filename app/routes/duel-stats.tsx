import { useFetcher } from '@remix-run/react';
import { type PlayersWithStats, getPlayers } from '~/services/player-service';
import {
  type RecentMatchPlayer,
  type RecentMatch,
  getRecent1v1Matches,
  revertLatestMatch,
} from '~/services/match-service';
import { PageContainerStyling } from './team-duel';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { BASE_ELO } from '~/utils/constants';

export const loader = async () => {
  const players = await getPlayers();
  const recent1v1Matches = await getRecent1v1Matches(5);

  return typedjson({ players, recent1v1Matches });
};

export const action = async () => {
  await revertLatestMatch();
  return null;
};

const calculateEloChangeFromMatch = (
  player: RecentMatchPlayer,
  match: RecentMatch,
  players: PlayersWithStats
) => {
  const playerWithStats = players.find((p) => p.id === player.id);
  if (!playerWithStats) {
    console.error(`Player ${player.name} not found in player list`);
    return 0;
  }

  // First match, no prior matches so must handle from base elo of 1500
  if (playerWithStats.eloLogs.length === 1) {
    return Math.abs(playerWithStats.eloLogs[0].elo - BASE_ELO);
  }

  const currentMatchEloIndex = playerWithStats.eloLogs.findIndex(
    (log) => match.id === log.matchId
  );
  const formerMatchEloIndex = currentMatchEloIndex + 1;

  const currentMatchElo = playerWithStats.eloLogs[currentMatchEloIndex].elo;
  const formerMatchElo = playerWithStats.eloLogs[formerMatchEloIndex].elo;

  return Math.abs(currentMatchElo - formerMatchElo);
};

const getEloForPlayerAfterMatch = (
  player: RecentMatchPlayer,
  match: RecentMatch,
  players: PlayersWithStats
) => {
  const playerWithStats = players.find((p) => p.id === player.id);
  if (!playerWithStats) {
    console.error(`Player ${player.name} not found in enriched player list`);
    return 0;
  }

  const matchEloIndex = playerWithStats.eloLogs.findIndex(
    (log) => match.id === log.matchId
  );
  // No match played
  if (matchEloIndex === -1) {
    return BASE_ELO;
  }

  return playerWithStats.eloLogs[matchEloIndex].elo;
};

const isLatestMatch = (idx: number) => idx === 0;

const isMatchLessThan5MinutesOld = (matchDate: Date) => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return matchDate > fiveMinutesAgo;
};

const getRowHighlightClass = (idx: number, matchDate: Date) =>
  isLatestMatch(idx) && isMatchLessThan5MinutesOld(matchDate)
    ? 'bg-slate-100 dark:bg-gray-700'
    : '';

export default function Index() {
  const fetcher = useFetcher();
  const { players, recent1v1Matches } = useTypedLoaderData<typeof loader>();

  const rankedPlayersSortedOnELODesc = [...players]
    .filter((a) => a.currentELO !== BASE_ELO)
    .sort((p1, p2) => p2.currentELO - p1.currentELO);

  return (
    <div className={PageContainerStyling}>
      <section className="py-4">
        <h2 className="mb-3 text-xl font-bold md:text-2xl dark:text-white">
          Nylige kamper
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b dark:border-gray-600">
                <th className="w-1/3 py-2">Tidspunkt</th>
                <th className="w-1/3 py-2">Vinner</th>
                <th className="w-1/3 py-2">Taper</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent1v1Matches.map((match, idx) => (
                <tr
                  key={match.id}
                  className={`border-b dark:border-gray-600 ${getRowHighlightClass(idx, match.date)}`}
                >
                  <td className="py-2 dark:text-white">
                    {match.date.toLocaleString('no-NO', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Oslo',
                    })}
                  </td>
                  <td className="py-2 dark:text-white">
                    <span className="font-semibold">{match.winner.name}</span>
                    <div>
                      <span className="font-medium text-[#00754E] dark:text-[#70C7AA]">
                        {getEloForPlayerAfterMatch(
                          match.winner,
                          match,
                          players
                        )}
                      </span>
                      {` (+${calculateEloChangeFromMatch(match.winner, match, players)}) `}
                    </div>
                  </td>
                  <td className="py-2 dark:text-white">
                    <span className="font-semibold">{match.loser.name}</span>
                    <div>
                      <span className="font-medium text-[#E44244] dark:text-[#EC7B7C]">
                        {getEloForPlayerAfterMatch(match.loser, match, players)}
                      </span>
                      {` (-${calculateEloChangeFromMatch(match.loser, match, players)})`}
                    </div>
                  </td>
                  <td>
                    {isLatestMatch(idx) &&
                      isMatchLessThan5MinutesOld(match.date) && (
                        <button
                          onClick={() => fetcher.submit({}, { method: 'post' })}
                          className="mx-4 rounded bg-blue-600 px-2 py-1 font-bold text-white hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-800"
                        >
                          Angre
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="py-4">
        <h2 className="mb-3 text-xl font-bold md:text-2xl dark:text-white">
          Spillere
        </h2>
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="w-2/5 py-2 dark:text-white">Navn</th>
              <th className="w-1/5 py-2 dark:text-white">Seiere (&#128293;)</th>
              <th className="w-1/5 py-2 dark:text-white">Tap</th>
              <th className="w-1/5 py-2 dark:text-white">ELO</th>
            </tr>
          </thead>

          <tbody>
            {rankedPlayersSortedOnELODesc
              .filter(
                (a) => a.matchesAsWinner.length + a.matchesAsLoser.length > 3
              )
              .map((player) => (
                <tr
                  key={player.id}
                  className="border-t text-lg dark:border-gray-700"
                >
                  <td className="py-2 font-semibold dark:text-white">
                    {player.name}
                  </td>
                  <td className="py-2 dark:text-white">
                    {`${player.matchesAsWinner.length}` +
                      (player.winStreak > 0 ? ` (${player.winStreak})` : '')}
                  </td>
                  <td className="py-2 dark:text-white">
                    {player.matchesAsLoser.length}
                  </td>
                  <td className="py-2 dark:text-white">{player.currentELO}</td>
                </tr>
              ))}
          </tbody>
          <tbody>
            <tr>
              <th colSpan={4} scope="col" className="py-4">
                <span className="text-xl font-bold md:text-2xl dark:text-white">
                  Spillere med få kamper
                </span>
                <div>
                  <span className="pl-2 text-sm dark:text-gray-400">
                    (Mindre enn 4 kamper spilt)
                  </span>
                </div>
              </th>
            </tr>
            {rankedPlayersSortedOnELODesc
              .filter(
                (a) => a.matchesAsWinner.length + a.matchesAsLoser.length <= 3
              )
              .map((player) => (
                <tr
                  key={player.id}
                  className="border-t text-lg dark:border-gray-700"
                >
                  <td className="py-2 font-semibold dark:text-white">
                    {player.name}
                  </td>
                  <td className="py-2 dark:text-white">
                    {`${player.matchesAsWinner.length}` +
                      (player.winStreak > 0 ? ` (${player.winStreak})` : '')}
                  </td>
                  <td className="py-2 dark:text-white">
                    {player.matchesAsLoser.length}
                  </td>
                  <td></td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
