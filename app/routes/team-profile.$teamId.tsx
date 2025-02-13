import { type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useNavigate } from '@remix-run/react';
import { EloHistoryChart } from '~/components/elo-history-charts';
import { getTeams } from '~/services/team-service';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import Select from 'react-select';
import { PageContainerStyling } from './team-duel';

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

  const teamOptions = teams.map((team) => ({
    value: team.id,
    label: team.name,
  }));

  const numberOfWins = team ? team.teamMatchesAsWinner.length : 0;
  const numberOfLosses = team ? team.teamMatchesAsLoser.length : 0;
  const numberOfMatches = numberOfWins + numberOfLosses;
  const winPercentage = (numberOfWins / numberOfMatches) * 100;

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
              Lagspill Statistikk
            </h2>
            <div className="grid grid-cols-4 gap-4 rounded-lg bg-white p-6 pr-8 shadow-lg dark:bg-gray-800">
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
