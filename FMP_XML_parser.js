

const https = require('https');
const http = require('http');
const fs = require('fs');

const express = require('express');
var app = express();

//Node-FTP github https://github.com/mscdex/node-ftp
const Client = require('ftp'); 

//Fast-XML-Parser github https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/docs/v4/1.GettingStarted.md
const  { XMLParser, XMLBuilder, XMLValidator}  = require('fast-xml-parser');
const parserOptions = 
{
    ignoreAttributes: false,
    attributeNamePrefix : "att_"
};
var parser = new XMLParser(parserOptions);

const HubTracker_Config = require('./HubTracking_Config.js')
const fmpAuthentication = HubTracker_Config.fmpAuthentication_Config;
const ftpConfig = HubTracker_Config.FTPConnector_Config;

var port = 3000;

var outputData = 
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
}

//Sets up HTTPS and HTTP servers
var httpsServer = https.createServer({
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
//Copied from stackoverflow, I have no idea what this means but it makes the code work
app.use(function(req, res, next) 
{
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

//application requests
app.get('/Search', (req, res) => 
{
    let parsedXMLfile;
    var podToSearch = req.query.searchfor;

    //XML request to the filemaker server, searches for a matching BOL, POD, or PRO #
    var xmlFile = "http://192.168.1.250/fmi/xml/fmresultset.xml?-db=DeliveryBoard&-lay=DB+BLFull+List+Card&-query=(q1);(q2);(q3)&-q1=POD_NUMBER&-q1.value=" 
    + podToSearch + "&-q2=BOL_NUMBER&-q2.value=" 
    + podToSearch + "&-q3=PRO_NUMBER&-q2.value=" 
    + podToSearch + "&-findquery";

    console.log(xmlFile)

    /* TEST DATABASE
    var xmlFile = "http://192.168.1.183/fmi/xml/fmresultset.xml?-db=DeliveryBoard-TEST&-lay=DB+BLFull+List+Card&-query=(q1);(q2);(q3)&-q1=POD_NUMBER&-q1.value=" 
    + podToSearch + "&-q2=BOL_NUMBER&-q2.value=" 
    + podToSearch + "&-q3=PRO_NUMBER&-q2.value=" 
    + podToSearch + "&-findquery";
    */
    //HTTP request to get the XML data from FMP's webpublishing engine 
    var httpRequest = http.get(xmlFile, fmpAuthentication, function(response)
    {

        console.log('STATUS: ' + response.statusCode);
        console.log('HEADERS: ' + JSON.stringify(response.headers));

        var bodyChunks = [];
        response.on('data', function(chunk) 
        {
            bodyChunks.push(chunk);
        }).on('end', function()
        {
            var body = Buffer.concat(bodyChunks);
            //Uses fast-xml-parser to parse the body data from the http request
            parsedXMLfile = parser.parse(body);
            outputData.errorCode = parsedXMLfile.fmresultset.error.att_code;

            if(parsedXMLfile.fmresultset.error.att_code == '0')
                parseJson(parsedXMLfile);
        
            res.json(outputData)
            outputData.records = [];
        })
    });
})

 

//FUNCTIONS -----------------------

function uploadSignature(podToUpload)
{  

    var toUpload = podToUpload.Pod_Number + ".jpg"; //TODO: Once FTP upload is functioning, change this to a direct file. For rightnow we just need the destination

    // mm/dd/yyyy
    var dateSplit = podToUpload.Date_Shipped.split('/')
    //Use the date delivered field to upload to the correct location 
    var uploadDestination = "PODs/" + dateSplit[2] + '/' + dateSplit[0] + '/' + dateSplit[1] + '/' + toUpload;

    podToUpload.Signature_Image = uploadDestination;

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

function parseJson(JSONtoParse)
{
    /*
    Converted data looks like this...
    fmresultset -> resultset -> record -> field -> (position in array) -> data

    field array positions we care about (The names from the XML file is lost so we have to hard code this)
        0: Who signed the BOL
        1: if it's opened or closed
        2: Delivery status
        3 -> 7: address stored in diffrent parts
            3: Deliver to
            4: Address
            5: Town name
            6: State
            7: Zip code
        23: Date compleated
        25: BOL #
        31: Customer PO#
        78: Time compleated
        124: POD #

        Use this for quick access
        JSONtoParse.fmresultset.resultset.record.field[X].data
    */

    //Converts the resultset count to a int
    var recordCount = JSONtoParse.fmresultset.resultset.att_count.charCodeAt(0) - '0'.charCodeAt(0);
    outputData.recordsFound = recordCount;

    //Checks to see if there's been multiple records found, if so record all of them
    //This is needed because Fast-XML-Parser will only make an array if there are children to a node
    if(recordCount > 1)
    {

        for(let i = 0; i < recordCount; i++)
        {
            var record =
            {
                Pod_Number: JSONtoParse.fmresultset.resultset.record[i].field[27].data,
                Bol_Number: JSONtoParse.fmresultset.resultset.record[i].field[25].data,
                Pro_Number: JSONtoParse.fmresultset.resultset.record[i].field[26].data,
                Delivery_Status: JSONtoParse.fmresultset.resultset.record[i].field[1].data,
                Signed_By: JSONtoParse.fmresultset.resultset.record[i].field[76].data,
                Date_Shipped: JSONtoParse.fmresultset.resultset.record[i].field[23].data,
                Date_Delivered: JSONtoParse.fmresultset.resultset.record[i].field[77].data,
                Time_Delivered: JSONtoParse.fmresultset.resultset.record[i].field[78].data,
                Signature_Image:"" //Kept blank, will be changed in the upload Signature function
            }
            //Makes sure the image of the POD is uploated
            uploadSignature(record);
            outputData.records.push(record);
        }    
    }
    else
    {
        var record =
        {
            Pod_Number: JSONtoParse.fmresultset.resultset.record.field[27].data,
            Bol_Number: JSONtoParse.fmresultset.resultset.record.field[25].data,
            Pro_Number: JSONtoParse.fmresultset.resultset.record.field[26].data,
            Delivery_Status: JSONtoParse.fmresultset.resultset.record.field[1].data,
            Signed_By: JSONtoParse.fmresultset.resultset.record.field[76].data,
            Date_Shipped: JSONtoParse.fmresultset.resultset.record.field[23].data,
            Date_Delivered: JSONtoParse.fmresultset.resultset.record.field[77].data,
            Time_Delivered: JSONtoParse.fmresultset.resultset.record.field[78].data,
            Signature_Image:"" //Kept blank, will be changed in the upload Signature function
        }
        uploadSignature(record);
        outputData.records.push(record);
    }

}



