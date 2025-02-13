import { type MetaFunction, type LoaderFunctionArgs } from '@remix-run/node';
import { useNavigate } from '@remix-run/react';
import { PlayerWithStats, getPlayers } from '../services/player-service';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import Select, { createFilter } from 'react-select';
import { PageContainerStyling } from './team-duel';

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

  const playerOptions = players.map((player) => ({
    value: player.id,
    label: player.name,
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

export default function Index() {
  const navigate = useNavigate();
  const { playerOptions, player1, player2, player1WinStats } =
    useTypedLoaderData<typeof loader>();

  // TODO: migrate datamodel to include elo gains/loses (recalculate elo values?)
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
                  ? player1WinStats.winPercentage.toFixed(2)
                  : 0}
                %
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Overlegenhet
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
