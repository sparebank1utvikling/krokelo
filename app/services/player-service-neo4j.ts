import { neo4jDriver } from '~/neo4j-driver';

interface Player {
  id: string;
  name: string;
  inactive: boolean;
}

interface PlayerWithStats {
  id: number;
  name: string;
  currentELO: number;
  inactive: boolean;
  nbMatchesWon: number;
  nbMatchesLost: number;
  winStreak: number;
}

export const getPlayers = async () => {
  const neo4jSession = neo4jDriver.session();

  try {
    const res = await neo4jSession.executeRead((tx) =>
      tx.run(
        `
        MATCH (player:Player)-[:HAS_CURRENT_ELO]->(elo:EloRating)
        RETURN {
          id: player.id,
          name: player.name,
          inactive: player.inactive,
          currentELO: elo.rating,
          nbMatchesWon: COUNT {(player)-[:WON]->(:Match) },
          nbMatchesLost: COUNT {(player)-[:LOST]->(:Match) },
          winStreak: COUNT { (player)-[:HAS_CURRENT_ELO]->(:EloRating) ((nextElo)-[:PREVIOUS_ELO]->(prevElo) WHERE nextElo.rating >= prevElo.rating){1,} }
        } as player
        `
      )
    );

    const players: PlayerWithStats[] = res.records.map((row) =>
      row.get('player')
    );
    return players;
  } finally {
    // Close the Session
    await neo4jSession.close();
  }
};

export const findOrCreatePlayer = async (name: string) => {
  const neo4jSession = neo4jDriver.session();

  try {
    const res = await neo4jSession.executeWrite((tx) =>
      tx.run(
        `
        MERGE (player:Player { name: $name })
        ON CREATE
          SET player.id = apoc.create.uuidBase64()
          SET player.createdDatetime = datetime.transaction()
          SET player.inactive = false
        RETURN player
        `,
        { name }
      )
    );

    const player: Player = res.records[0].get('player');
    return player;
  } finally {
    // Close the Session
    await neo4jSession.close();
  }
};
