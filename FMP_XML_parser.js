const https = require('https');
const http = require('http');
const fs = require('fs');

const express = require('express');
const app = express();

//Node-FTP github https://github.com/mscdex/node-ftp
const Client = require('ftp'); 

//Fast-XML-Parser GitHub https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/docs/v4/1.GettingStarted.md
const  { XMLParser, XMLBuilder, XMLValidator}  = require('fast-xml-parser');
const parserOptions = 
{
    ignoreAttributes: false,
    attributeNamePrefix : "att_"
};
var parser = new XMLParser(parserOptions);

const HubTracker_Config = require('./HubTracking_Config.js')
const {json} = require("express");
const fmpAuthentication = HubTracker_Config.fmpAuthentication_Config;
const ftpConfig = HubTracker_Config.FTPConnector_Config;

const port = 3000;
const serverip = "192.168.1.183"

const outputData =
    {
        recordsFound: 0,
        errorCode: "",
        /*
        record:
        [{
            podNumber: "",
            bolNumber: "",
            proNumber: "",
            deliveryStatus: "",
            signedBy: "",
            dateShipped: "",
            timeDelivered: "",
            signatureLocation:""
        }],
        */
        records: []
    };

//Sets up HTTPS and HTTP servers
const httpsServer = https.createServer({
    key: fs.readFileSync('./Hostcentric_SSL_Certification/www.hubdelivery.com.key'),
    cert: fs.readFileSync('./Hostcentric_SSL_Certification/www.hubdelivery.com.crt')
}, app);
httpsServer.listen(port, ()=>
{
    console.log(`Https listening on port ${port}`)
});

/*
app.listen(port, () => 
{
    console.log(`Listening on port ${port}`)
})
*/

//Just a setting for enable CORS (Cross-origin resource sharing )
//Copied from stackoverflow, I have no idea what this means, but it makes the code work
app.use(function(req, res, next) 
{
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

//application requests
app.get('/Search', (req, res) => 
{

    let fieldsToDisplay =
        {
            ID_NUMBER: { toDisplay: "ID Number", toSearch: "ID_NUMBER"},
            ID_PCS: { toDisplay: "Unit Count", toSearch: "ID_PCS"},
            ID_LBS: { toDisplay: "Delivery Weight", toSearch: "ID_LBS"},
            REF_NUMBER: { toDisplay: "Order Number", toSearch: "xml_ref::REF_NUMBER"},
            SH_LOCATION: { toDisplay: "SH Location", toSearch: "xml_ref::SH_Location"},
            CN_NAME: { toDisplay: "CN Name", toSearch: "xml_bol::CN_NAME"},
            CN_ADDRESS: { toDisplay: "Address", toSearch: "xml_bol::CN_ADDRESS"},
            CN_CITY: { toDisplay: "City", toSearch: "xml_bol::CN_CITY"},
            CN_STATE: { toDisplay: "State", toSearch: "xml_bol::CN_STATE"},
            CN_ZIP: { toDisplay: "Zip Code", toSearch: "xml_bol::CN_ZIP"},
            BOL_NUMBER: { toDisplay: "BOL Number", toSearch: "xml_bol::BOL_NUMBER"},
            PRO_NUMBER: { toDisplay: "PRO Number", toSearch: "xml_bol::PRO_NUMBER"},
            POD_NUMBER: { toDisplay: "POD Number", toSearch: "xml_bol::POD_NUMBER"},
            SERVICE_STATUS: { toDisplay: "Service Status", toSearch: "xml_bol::Status_Service"},
            DATE_EXPECTED: { toDisplay: "Expected Delivery Date", toSearch: "xml_bol::DATE_EXPECTED"},
            REC_BY: { toDisplay: "Received By", toSearch: "xml_bol::POD_RECBY"},
            REC_TIME: { toDisplay: "Time Received", toSearch: "xml_bol::POD_RECTIME"},
            DATE_DELIVERED: { toDisplay: "Date Delivered", toSearch: "xml_bol::DATE_DELIVERED"}
        }

    let database = "LogicBoard"
    let layout = "xml_ID"
    let toSearch = req.query.searchfor;
    let xmlQuery = `-query=(q1);(q2);(q3)&-q1=ID_NUMBER&-q1.value=${toSearch}&-q2=xml_bol::BOL_NUMBER&-q2.value=${toSearch}&-q3=xml_bol::PRO_NUMBER&-q2.value=${toSearch} `

    res.json(BuildOutputData(database, layout, xmlQuery, fieldsToDisplay))
    outputData.records = [];
})

//FUNCTIONS -----------------------

function BuildOutputData(database, layout, searchQuery, fieldsToDisplay)
{
    let parsedXML;

    //XML request to the filemaker server, searches for a matching BOL, POD, or PRO #
    const xmlFile = `http://${serverip}/fmi/xml/fmresultset.xml?-db=${database}&-lay=${layout}&${searchQuery}&-findquery`;
    console.log(xmlFile)

    //HTTP request to get the XML data from FMP's webpublishing engine
    const httpRequest = http.get(xmlFile, fmpAuthentication, function (response)
    {
        console.log('STATUS: ' + response.statusCode);
        console.log('HEADERS: ' + JSON.stringify(response.headers));

        let bodyChunks = [];
        response.on('data', function (chunk)
        {
            bodyChunks.push(chunk);
        }).on('end', function ()
        {
            let body = Buffer.concat(bodyChunks);
            //Uses fast-xml-parser to parse the body data from the http request
            parsedXML = parser.parse(body);
            outputData.errorCode = parsedXML.fmresultset.error.att_code;

            if (parsedXML.fmresultset.error.att_code === '0')
            {
                //Converts the resultset count to an int
                outputData.recordsFound =  parsedXML.fmresultset.resultset.att_count.charCodeAt(0) - '0'.charCodeAt(0);

                //Checks to see if there's been multiple records found, if so record all of them
                //This is needed because Fast-XML-Parser will only make an array if there are children to a node
                if(outputData.recordsFound > 1)
                {
                    for(let i = 0; i < outputData.recordsFound; i++)
                    {
                        let record = {};

                        for(const key in fieldsToDisplay)
                        {
                            record[fieldsToDisplay[key].toDisplay] = jsonSearch(parsedXML.fmresultset.resultset.record[i].field, "att_name", fieldsToDisplay[key].toSearch);
                        }

                        //Makes sure the image of the POD is uploaded
                        uploadSignature(record, record[[fieldsToDisplay.POD_NUMBER.toDisplay]], record[[fieldsToDisplay.DATE_DELIVERED.toDisplay]]);
                        outputData.records.push(record);
                    }
                }
                else
                {
                    let record = {};
                    for(const key in fieldsToDisplay)
                    {
                        record[fieldsToDisplay[key].toDisplay] = jsonSearch(parsedXML.fmresultset.resultset.record.field, "att_name", fieldsToDisplay[key].toSearch);
                    }

                    //Makes sure the image of the POD is uploaded
                    uploadSignature(record, record[[fieldsToDisplay.POD_NUMBER.toDisplay]], record[[fieldsToDisplay.DATE_DELIVERED.toDisplay]]);
                    outputData.records.push(record);
                }
            }
        })
    });
    return(outputData)
}

function jsonSearch(jsonArray, attributeToSearch, resultToSearch)
{
    let returnValue = "Not Found"

    for(let i = 0; i < jsonArray.length; i++)
    {
        if(jsonArray[i][attributeToSearch] === resultToSearch)
        {
            returnValue = jsonArray[i].data;
            break;
        }
    }
    return returnValue
}

function uploadSignature(recordToUpload, podNumber, dateShipped)
{
    const toUpload = podNumber + ".jpg"; //TODO: Once FTP upload is functioning, change this to a direct file. For rightnow we just need the destination

    // mm/dd/yyyy
    const dateSplit = dateShipped.split('/');
    //Use the date delivered field to upload to the correct location
    recordToUpload["Signature_Image"] = "PODs/" + dateSplit[2] + '/' + dateSplit[0] + '/' + dateSplit[1] + '/' + toUpload;

    //TODO: Once the FMP database is on this server machine, use this code to upload to the domain server
    /*
    var ftpClient = new Client();
    ftpClient.on('ready', function() {
        ftpClient.put(toUpload, uploadDestination, function(err) {
        if (err) throw err;
        ftpClient.end();
      });
    });
    ftpClient.connect(ftpConfig);
    */
}

