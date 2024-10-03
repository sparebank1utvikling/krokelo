# Welcome to [Krokelo](https://krokelo.sb1u.no/)!

Krokelo is a web application created to track [Crocinole](https://en.wikipedia.org/wiki/Crokinole) games at SpareBank 1 Utvikling. You can submit duel games (1 vs 1) and team games (2 vs 2), and the application will calculate [Elo ratings](https://en.wikipedia.org/wiki/Elo_rating_system) for players and teams. Leaderboard and profile pages shows the current stats.

The application is implemented in [Remix](https://remix.run/docs) with a [Postgres](https://en.wikipedia.org/wiki/PostgreSQL) database.

## Development

### Spin up a Postgres dataabse

```sh
docker run --name postgres16 -e POSTGRES_DB=krokelo -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=666 -p 5432:5432 -d postgres:16
```

### Create a .env file with required environment variables

```
DATABASE_URL="postgresql://postgres:666@localhost:5432/krokelo"
COOKIE_SECRET="s3cr3ts3cr3t"
```

### Start app in development mode

```sh
npm install             # Install dependencies
npm run setup:db        # Setup Prisma and migrate database
npm run dev             # Start app in dev mode with hot reload
```

### (Optional) Use prod data in local dev

There is a backup of the production data included in this project in the db_backups folder.
You can use this to get a more realistic dev env.
You can restore the backup data to your local db instance in pgadmin4 or via terminal:

```sh
docker cp db_backups/03oct2024.dump {container_id}:/03oct2024.dump
docker exec -i postgres16 pg_restore --clean --no-owner --no-privileges -U postgres -d krokelo 03oct2024.dump
```

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

### Cheat sheet commands for database backup and restore

```sh
# Backup database
pg_dump -Fc "postgresql://username:password@host:port/dbname" > db.dump
# Restore database (same owner and roles)
pg_restore --verbose -d dbname db.dump -h host -p port -U username
# Restore database (new owners and roles)
pg_restore --verbose --no-owner --role=username -d dbname db.dump -h host -p port -U username
```
