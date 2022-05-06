const {BaseRedisCache} = require("apollo-server-cache-redis");
const {ApolloServer} = require("apollo-server-express");
const responseCachePlugin = require("apollo-server-plugin-response-cache");
const {connectToRedis} = require("./redis");

module.exports.getServer = (schema, tcrd, app) => {
    return connectToRedis().then(redisClient => {
        const serverOptions = {
            schema: schema,
            introspection: true,
            plugins: [responseCachePlugin()],
            playground: true,
            dataSources: () => ({
                tcrd: tcrd
            })
        };
        if (redisClient) {
            serverOptions.cache = new BaseRedisCache({ client: redisClient });
            serverOptions.dataSources = () => ({
                tcrd: tcrd,
                redis: redisClient
            });
        }
        const server = new ApolloServer(serverOptions);
        server.applyMiddleware({
            app,
            path: '/graphql'
        });

        return {apollo: server, redis: redisClient};
    });
}