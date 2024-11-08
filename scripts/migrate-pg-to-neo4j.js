import pkg from 'pg';
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pkg;

// PostgreSQL connection
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

pgClient.connect();

// need to make timestamp without time zone be interpreted as UTC, ref. https://github.com/brianc/node-postgres/issues/993#issuecomment-267684417
pkg.types.setTypeParser(1114, function (stringValue) {
  return new Date(stringValue + 'Z');
});

// Neo4j connection
const neo4jDriver = neo4j.driver(
  'bolt://localhost:7687', // Replace with your Neo4j instance address
  neo4j.auth.basic('neo4j', 'your_password') // Replace with your credentials
);
const neo4jSession = neo4jDriver.session();

async function migrateData() {
  try {
    let lastMatchId = null;
    let lastEloRatingId = null;

    // Migrate Players
    const playersRes = await pgClient.query(
      'SELECT * FROM "Player" ORDER BY id'
    );
    for (let row of playersRes.rows) {
      await neo4jSession.run(
        `CREATE (p:Player {id: $id, name: $name, inactive: $inactive})`,
        {
          id: row.id,
          name: row.name,
          inactive: row.inactive,
        }
      );
    }

    // Migrate 1v1 Matches
    const matchesRes = await pgClient.query(
      'SELECT * FROM "Match" ORDER BY id'
    );
    for (let row of matchesRes.rows) {
      await neo4jSession.run(
        `CREATE (m:Match {id: $id, createdDatetime: datetime($date)})`,
        {
          id: row.id,
          date: row.date.toISOString(),
        }
      ); // LATEST_MATCH, FIRST_MATCH

      // Create relationships between Match and Players
      await neo4jSession.run(
        `MATCH (m:Match {id: $matchId}), (w:Player {id: $winnerId}), (l:Player {id: $loserId})
         CREATE (w)-[:WON]->(m)<-[:LOST]-(l)`,
        {
          matchId: row.id,
          winnerId: row.winnerId,
          loserId: row.loserId,
        }
      );
      lastMatchId = row.id;
    }

    // Migrate 1v1 ELOLogs
    const eloLogsRes = await pgClient.query(
      'SELECT * FROM "ELOLog" ORDER BY id'
    );
    for (let row of eloLogsRes.rows) {
      await neo4jSession.run(
        `CREATE (e:EloRating {id: $id, rating: $elo})
         WITH e
         MATCH (p:Player {id: $playerId}), (m:Match {id: $matchId})
         WITH e, p, m
         OPTIONAL MATCH (p)-[prevRel:HAS_CURRENT_ELO]->(prevElo:EloRating)
         WITH e, p, m, prevRel, prevElo
         CREATE (p)-[:HAS_CURRENT_ELO]->(e)-[:AFTER]->(m)
         WITH e, prevRel, prevElo
         WHERE prevElo IS NOT NULL
         CREATE (e)-[:PREVIOUS_ELO]->(prevElo)
         DELETE prevRel`,
        {
          id: row.id,
          elo: row.elo,
          playerId: row.playerId,
          matchId: row.matchId,
        }
      );
      lastEloRatingId = row.id;
    }

    // Migrate createdDatetime to Player from first match
    await neo4jSession.run(
      `MATCH (p:Player)-[:WON|LOST]->(m:Match)
       WITH p, min(m.createdDatetime) AS firstMatchCreatedDatetime
       SET p.createdDatetime = firstMatchCreatedDatetime`
    );

    // Migrate createdDatetime to EloRating from related match
    await neo4jSession.run(
      `MATCH (e:EloRating)-[:AFTER]->(m:Match)
       SET e.createdDatetime = m.createdDatetime`
    );

    // Migrate Teams
    const teamsRes = await pgClient.query(
      `SELECT 
        t.id AS teamId,
        p.id AS playerId
      FROM 
        "Team" t
      JOIN 
        "_TeamMembers" pt ON pt."B" = t.id
      JOIN 
        "Player" p ON pt."A" = p.id
      ORDER BY 
        t.id`
    );
    for (let row of teamsRes.rows) {
      await neo4jSession.run(
        `MERGE (t:Team {id: $teamId})
         WITH t
         MATCH (p:Player {id: $playerId})
         MERGE (p)-[:MEMBER_OF]->(t)`,
        {
          teamId: row.teamid,
          playerId: row.playerid,
        }
      );
    }

    // Migrate Team Matches
    const teamMatchesRes = await pgClient.query(
      'SELECT * FROM "TeamMatch" ORDER BY id'
    );
    for (let row of teamMatchesRes.rows) {
      const teamMatchId = row.id + lastMatchId;
      await neo4jSession.run(
        `CREATE (m:Match {id: $id, createdDatetime: datetime($date)})`,
        {
          id: teamMatchId,
          date: row.date.toISOString(),
        }
      );

      // Create relationships between Match and Teams
      await neo4jSession.run(
        `MATCH (m:Match {id: $teamMatchId}), (w:Team {id: $winnerId}), (l:Team {id: $loserId})
         CREATE (w)-[:WON]->(m)<-[:LOST]-(l)`,
        {
          teamMatchId: teamMatchId,
          winnerId: row.winnerTeamId,
          loserId: row.loserTeamId,
        }
      );
    }

    // Migrate Team ELOLogs
    const teamEloLogsRes = await pgClient.query(
      'SELECT * FROM "TeamELOLog" ORDER BY id'
    );
    for (let row of teamEloLogsRes.rows) {
      const eloRatingId = row.id + lastEloRatingId;
      const teamMatchId = row.teamMatchId + lastMatchId;
      await neo4jSession.run(
        `CREATE (e:EloRating {id: $id, rating: $elo})
         WITH e
         MATCH (t:Team {id: $teamId}), (m:Match {id: $teamMatchId})
         WITH e, t, m
         OPTIONAL MATCH (t)-[prevRel:HAS_CURRENT_ELO]->(prevElo:EloRating)
         WITH e, t, m, prevRel, prevElo
         CREATE (t)-[:HAS_CURRENT_ELO]->(e)-[:AFTER]->(m)
         WITH e, prevRel, prevElo
         WHERE prevElo IS NOT NULL
         CREATE (e)-[:PREVIOUS_ELO]->(prevElo)
         DELETE prevRel`,
        {
          id: eloRatingId,
          elo: row.elo,
          teamId: row.teamId,
          teamMatchId: teamMatchId,
        }
      );
    }
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pgClient.end();
    await neo4jSession.close();
    await neo4jDriver.close();
  }
}

migrateData();
