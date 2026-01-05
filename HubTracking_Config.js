//Config consts, seperate file for password security and readablitly for non devolpers

const fmpAuthentication_Config = 
{
    auth: ""
};

//Node-FTP github https://github.com/mscdex/node-ftp
const FTPConnector_Config =
{
    host: "",
    user: "",
    password: ""
};

const IpInfo =
    {
        ip: "",
        port: 3000
    }


module.exports = { fmpAuthentication_Config, FTPConnector_Config, IpInfo }