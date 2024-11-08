import { useFetcher } from '@remix-run/react';
import { getPlayers as getPlayersNeo4j } from '~/services/player-service-neo4j';
import { revertLatest1v1Match } from '~/services/match-service';
import { getRecent1v1Matches as getRecent1v1MatchesNeo4j } from '~/services/match-service-neo4j';
import { PageContainerStyling } from './team-duel';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { BASE_ELO } from '~/utils/constants';

export const loader = async () => {
  const playersNeo4j = await getPlayersNeo4j();
  const recent1v1MatchesNeo4j = await getRecent1v1MatchesNeo4j(5);

  return typedjson({
    playersNeo4j,
    recent1v1MatchesNeo4j,
  });
};

export const action = async () => {
  await revertLatest1v1Match();
  return null;
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
  const { playersNeo4j, recent1v1MatchesNeo4j } =
    useTypedLoaderData<typeof loader>();

  const rankedPlayersSortedOnELODesc = [...playersNeo4j]
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
              {recent1v1MatchesNeo4j.map((match, idx) => (
                <tr
                  key={match.id}
                  className={`border-b dark:border-gray-600 ${getRowHighlightClass(idx, match.createdDatetime)}`}
                >
                  <td className="py-2 dark:text-white">
                    {match.createdDatetime.toLocaleString('no-NO', {
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
                        {match.winner.eloAfterMatch}
                      </span>
                      {` (+${match.winner.eloDifference}) `}
                    </div>
                  </td>
                  <td className="py-2 dark:text-white">
                    <span className="font-semibold">{match.loser.name}</span>
                    <div>
                      <span className="font-medium text-[#E44244] dark:text-[#EC7B7C]">
                        {match.loser.eloAfterMatch}
                      </span>
                      {` (-${match.loser.eloDifference})`}
                    </div>
                  </td>
                  <td>
                    {isLatestMatch(idx) &&
                      isMatchLessThan5MinutesOld(match.createdDatetime) && (
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
                (a) => a.nbMatchesWon + a.nbMatchesLost > 4 && !a.inactive
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
                    {`${player.nbMatchesWon}` +
                      (player.winStreak > 0 ? ` (${player.winStreak})` : '')}
                  </td>
                  <td className="py-2 dark:text-white">
                    {player.nbMatchesLost}
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
                    (Mindre enn 5 kamper spilt)
                  </span>
                </div>
              </th>
            </tr>
            {rankedPlayersSortedOnELODesc
              .filter(
                (a) => a.nbMatchesWon + a.nbMatchesLost <= 4 && !a.inactive
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
                    {`${player.nbMatchesWon}` +
                      (player.winStreak > 0 ? ` (${player.winStreak})` : '')}
                  </td>
                  <td className="py-2 dark:text-white">
                    {player.nbMatchesLost}
                  </td>
                  <td></td>
                </tr>
              ))}
          </tbody>
        </table>
        <h2 className="mb-3 text-xl font-bold md:text-2xl dark:text-white">
          Inaktive spillere
        </h2>
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="w-2/5 py-2 dark:text-white">Navn</th>
              <th className="w-1/5 py-2 dark:text-white">Seiere</th>
              <th className="w-1/5 py-2 dark:text-white">Tap</th>
              <th className="w-1/5 py-2 dark:text-white">ELO</th>
            </tr>
          </thead>
          <tbody>
            {rankedPlayersSortedOnELODesc
              .filter((a) => a.inactive)
              .map((player) => (
                <tr
                  key={player.id}
                  className="border-t text-lg dark:border-gray-700"
                >
                  <td className="py-2 font-semibold dark:text-white">
                    {player.name}
                  </td>
                  <td className="py-2 dark:text-white">
                    {`${player.nbMatchesWon}`}
                  </td>
                  <td className="py-2 dark:text-white">
                    {player.nbMatchesLost}
                  </td>
                  <td className="py-2 dark:text-white">{player.currentELO}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
