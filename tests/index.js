require('dotenv').config();
// model
const {
    Model
} = require('objection');
const Knex = require('knex'); // Initialize knex.
const httpMocks = require('node-mocks-http');
const Controller = require('../lib/ApiController');

const knexInstance = Knex({
    client: 'mysql',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB
    }
});
Model.knex(knexInstance);

knexInstance.on('query', data => {
    console.log('======== on query ==========');
    let i = 0;
    let sql = data.sql.replace(/\?/g, k => {
        return '"' + data.bindings[i++] + '"';
    });
    console.log(sql);
    console.log('==================');
});

class UserModel extends Model {

    /**
     * @override
     */
    static get tableName() {
        return 'users';
    }

    /**
     * @override
     */
    static get jsonSchema() {
        return {
            search: ['emailid', 'firstname', 'lastname', 'name']
        }
    }
}

const usersController = new Controller(UserModel);
const requestSearchGlobal = httpMocks.createRequest({
    method: 'GET',
    url: '/user/42',
    query: {
        'q': 'jonathan',
        fields: 'firstname, lastname, name'
    }
});

const requestSearchByColumn = httpMocks.createRequest({
    method: 'GET',
    url: '/user/42',
    query: {
        'q.emailid': 'jonathan',
        fields: 'firstname, lastname, name'
    }
});

const response = httpMocks.createResponse();

const get = async () => {
    let data1 = await usersController.get(requestSearchGlobal, response, null, null, true);
    let data2 = await usersController.get(requestSearchByColumn, response, null, null, true);
    console.log('=========================');
    console.log('data requestSearchGlobal: ', data1);
    console.log('=========================');
    console.log('data requestSearchByColumn: ', data2);
    setTimeout(() => process.exit(), 200);
}
get();