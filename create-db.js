const {createConnection} = require("typeorm");

createConnection({
    type: 'postgres',
    host: process.env.HOST,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
}).then(async connection => {
    connection.query('CREATE DATABASE vinted_bot').catch(() => {
        console.log('--> Postgres: Database already exists');
    });
});
