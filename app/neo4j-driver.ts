import neo4j from 'neo4j-driver';

const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URL || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || 'neo4j',
    process.env.NEO4J_PASSWORD || 'neo4j'
  ),
  { disableLosslessIntegers: true }
);

export { neo4jDriver };
