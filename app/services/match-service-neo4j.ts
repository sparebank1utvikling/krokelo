import { neo4jDriver } from '~/neo4j-driver';

interface Recent1v1Match {
  id: number;
  createdDatetime: Date;
  winner: Recent1v1MatchPlayer;
  loser: Recent1v1MatchPlayer;
}

interface Recent1v1MatchPlayer {
  id: number;
  name: string;
  eloAfterMatch: number;
  eloBeforeMatch: number;
  eloDifference: number;
}

export const getRecent1v1Matches = async (limit: number = 5) => {
  const neo4jSession = neo4jDriver.session();

  try {
    const res = await neo4jSession.executeRead((tx) =>
      tx.run(
        `
        MATCH (winner:Player)-[:WON]->(match:Match)<-[:LOST]-(loser:Player)
        WITH match, winner, loser
        ORDER BY match.createdDatetime DESC
        LIMIT toInteger($limit)
        MATCH (winner)-[:HAS_CURRENT_ELO|PREVIOUS_ELO*0..]->(winnerEloAfterMatch:EloRating)-[:AFTER]->(match)
        WITH match, winner, winnerEloAfterMatch, loser
        MATCH (winnerEloAfterMatch)-[:PREVIOUS_ELO]->(winnerEloBeforeMatch:EloRating)
        WITH match, winner, winnerEloAfterMatch, winnerEloBeforeMatch, loser
        MATCH (loser)-[:HAS_CURRENT_ELO|PREVIOUS_ELO*0..]->(loserEloAfterMatch:EloRating)-[:AFTER]->(match)
        WITH match, winner, winnerEloAfterMatch, winnerEloBeforeMatch, loser, loserEloAfterMatch
        MATCH (loserEloAfterMatch)-[:PREVIOUS_ELO]->(loserEloBeforeMatch:EloRating)
        WITH match, winner, winnerEloAfterMatch, winnerEloBeforeMatch, loser, loserEloAfterMatch, loserEloBeforeMatch
        RETURN {
            id: match.id,
            createdDatetime: match.createdDatetime,
            winner: {
                id: winner.id,
                name: winner.name,
                eloAfterMatch: winnerEloAfterMatch.rating,
                eloBeforeMatch: winnerEloBeforeMatch.rating,
                eloDifference: winnerEloAfterMatch.rating - winnerEloBeforeMatch.rating
            },
            loser: {
                id: loser.id,
                name: loser.name,
                eloAfterMatch: loserEloAfterMatch.rating,
                eloBeforeMatch: loserEloBeforeMatch.rating,
                eloDifference: loserEloAfterMatch.rating - loserEloBeforeMatch.rating
            }
        } as match
        `,
        { limit }
      )
    );

    const matches: Recent1v1Match[] = res.records.map((row) => ({
      ...row.get('match'),
      createdDatetime: row.get('match').createdDatetime.toStandardDate(),
    }));
    return matches;
  } finally {
    // Close the Session
    await neo4jSession.close();
  }
};

export const record1v1Match = async (winnerId: string, loserId: string) => {
  const neo4jSession = neo4jDriver.session();

  try {
    await neo4jSession.executeWrite((tx) =>
      tx.run(
        `
        MATCH (winner:Player { id: $winnerId }), (loser:Player { id: $loserId })
        CREATE (match:Match { 
          id: apoc.create.uuidBase64(),
          createdDatetime: datetime.transaction() 
        })
        CREATE (winner)-[:WON]->(match)<-[:LOST]-(loser)
        WITH match, winner, loser
        OPTIONAL MATCH (winner)-[:HAS_CURRENT_ELO]->(winnerEloBeforeMatch:EloRating)
        WITH match, winner, winnerEloBeforeMatch, loser
        OPTIONAL MATCH (loser)-[:HAS_CURRENT_ELO]->(loserEloBeforeMatch:EloRating)
        WITH match, winner, winnerEloBeforeMatch, loser, loserEloBeforeMatch
        
        `,
        { winnerId, loserId }
      )
    );
  } finally {
    // Close the Session
    await neo4jSession.close();
  }
};

export const revertLatest1v1Match = async () => {
  const neo4jSession = neo4jDriver.session();

  try {
    await neo4jSession.executeWrite((tx) =>
      tx.run(
        `
        MATCH (latestMatch:Match)
        WHERE EXISTS { (latestMatch)<-[:WON]-(:Player) }
        WITH latestMatch
        ORDER BY latestMatch.createdDatetime DESC
        LIMIT 1
        MATCH (latestMatch)<-[:AFTER]-(eloAfterMatch:EloRating)<-[:PREVIOUS_ELO]-(eloBeforeMatch:EloRating)
        WITH latestMatch, eloAfterMatch, eloBeforeMatch
        MATCH (player:Player)-[:HAS_CURRENT_ELO]->(eloAfterMatch)
        WITH latestMatch, player, eloAfterMatch, eloBeforeMatch
        CREATE (player)-[:HAS_CURRENT_ELO]->(eloBeforeMatch)
        DETACH DELETE eloAfterMatch
        DETACH DELETE latestMatch
        `
      )
    );
  } finally {
    // Close the Session
    await neo4jSession.close();
  }
};
