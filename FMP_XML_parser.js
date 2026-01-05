const https = require('https');
const http = require('http');
const fs = require('fs');
const clc = require("cli-color"); // https://www.npmjs.com/package/cli-color

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
const port = HubTracker_Config.IpInfo.port;
const serverip = HubTracker_Config.IpInfo.ip;

const signatureImgPath = `/Volumes/FMP-Server/FMP_Files/RC_Data_FMS/LogicBoard/PODs`;

//Sets up HTTPS and HTTP servers
const httpsServer = https.createServer({
    key: fs.readFileSync('./Hostcentric_SSL_Certification/www.hubdelivery.com.key'),
    cert: fs.readFileSync('./Hostcentric_SSL_Certification/www.hubdelivery.com.crt')
}, app);
httpsServer.listen(port, ()=>
{
    console.log(clc.blue(`Https listening on port ${port}, do not close this window`))
});

//Just a setting for enable CORS (Cross-origin resource sharing )
//Copied from stackoverflow, I have no idea what this means, but it makes the code work
app.use(function(req, res, next) 
{
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/GetPODImg', async (req, res) =>
{
    //const signatureImage = `${signatureImgPath}/${dateSplit[2]}/${dateSplit[0]}/${dateSplit[1]}/${record[fieldsToDisplay.PRO_NUMBER.toDisplay]}.jpg`;
    let searchFor = req.query.searchfor;
    console.log(clc.green(`POD image request received, returning ${searchFor}`))
    let split = searchFor.split('/');
    //sent in mm/dd/yy/PODimg format
    let path = `${signatureImgPath}/${split[2]}/${split[0]}/${split[1]}/${split[3]}.jpg`;

    res.sendFile(path);
})

app.get('/GetSearchInfo', async (req, res) =>
{
    //Gather the info on the search and respond with a json
    let searchArry = req.query.searchfor.split(','); //Split the search by comma

    const outputs =
        {
            Results: [], //The results of the search
            DisplayType: "", //The type of display the webpage should show
            SearchName: req.query.searchfor
        };

    let fieldsToDisplayXML_BOL =
        {
            //Section 1 header info
            PRO_NUMBER: {toDisplay: "[PRO_NUMBER]", toSearch: "PRO_NUMBER"},
            BOL_NUMBER: {toDisplay: "[BOL_NUMBER]", toSearch: "BOL_NUMBER"},
            DATE_SHIPPED: {toDisplay: "[DATE_SHIPPED]", toSearch: "DATE_SHIPPED"},
            DATE_SCHEDULED: {toDisplay: "[DATE_SCHEDULED]", toSearch: "DATE_SCHEDULED"},
            DATE_SCHEDULED_TIME: {toDisplay: "[DATE_SCHEDULED_TIME]", toSearch: "DATE_SCHEDULE_TIME"},
            //Section 2, OSD
            OSD1: {toDisplay: "[OSD_O]", toSearch: "OSD_O"},
            OSD2: {toDisplay: "[OSD_S]", toSearch: "OSD_S"},
            OSD3: {toDisplay: "[OSD_D]", toSearch: "OSD_D"},
            //Section 3, notes
            NOTES: {toDisplay: "[NOTES_COMBINED]", toSearch: "Status_Service_Comment"},
            //Section 4, shipped & delivery address
            FR_NAME: {toDisplay: "[SH_NAME]", toSearch: "SH_NAME"},
            FR_ADDRESS:{toDisplay: "[SH_ADDRESS]", toSearch: "SH_ADDRESS"},
            FR_CITY: {toDisplay: "[SH_CITY]", toSearch: "SH_CITY"},
            FR_STATE: {toDisplay: "[SH_STATE]", toSearch: "SH_STATE"},
            FR_ZIP: {toDisplay: "[SH_ZIP]", toSearch: "SH_ZIP"},
            CN_NAME: {toDisplay: "[CN_NAME]", toSearch: "CN_NAME"},
            CN_ATTN: {toDisplay: "[CN_ATTN]", toSearch: "CN_ATTN"},
            CN_ADDRESS: {toDisplay: "[CN_ADDRESS]", toSearch: "CN_ADDRESS"},
            CN_CITY: {toDisplay: "[CN_CITY]", toSearch: "CN_CITY"},
            CN_STATE: {toDisplay: "[CN_STATE]", toSearch: "CN_STATE"},
            CN_ZIP: {toDisplay: "[CN_ZIP]", toSearch: "CN_ZIP"},
            //Stored in related sets
            RELATED_SETS: {
                //Set 6, ID #
                XML_ID: {
                    setName: "xml_id",
                    valuesInSet: { //Values in set XML_ID
                        ID_NUMBER: {toDisplay: "[ID_NUMBER]", toSearch: "xml_id::ID_NUMBER"},
                        ID_REF: {toDisplay: "[ID_REF]", toSearch: "xml_id::REF_NUMBER"},
                        ID_OSD1: {toDisplay: "[ID_OSD_O]", toSearch: "xml_id::ID_OSD_O"},
                        ID_OSD2: {toDisplay: "[ID_OSD_S]", toSearch: "xml_id::ID_OSD_S"},
                        ID_OSD3: {toDisplay: "[ID_OSD_D]", toSearch: "xml_id::ID_OSD_D"},
                    }}
                //Set 5, REF #
                , XML_REF: {
                    setName: "xml_ref",
                    valuesInSet: { //Values in set REF_NUMBER
                    REF_NUMBER: {toDisplay: "[REF_NUMBER]", toSearch: "xml_ref::REF_NUMBER"},
                        REF_SHIPMENT: {toDisplay: "[REF_SHIPMENT]", toSearch: "xml_ref::REF_Shipment"},
                        REF_CN_ATTN: {toDisplay: "[REF_CN_ATTN]", toSearch: "xml_ref::REF_CN_ATTN"},
                        REF_PO: {toDisplay: "[REF_PO]", toSearch: "xml_ref::REF_PO"},
                        REF_PLT: {toDisplay: "[REF_PLT]", toSearch: "xml_ref::REF_PLT"},
                        REF_PCS: {toDisplay: "[REF_PCS]", toSearch: "xml_ref::REF_PCS"},
                        REF_LBS: {toDisplay: "[REF_LBS]", toSearch: "xml_ref::REF_LBS"},
                        REF_OSD1: {toDisplay: "[REF_OSD_O]", toSearch: "xml_ref::REF_OSD_O"},
                        REF_OSD2: {toDisplay: "[REF_OSD_S]", toSearch: "xml_ref::REF_OSD_S"},
                        REF_OSD3: {toDisplay: "[REF_OSD_D]", toSearch: "xml_ref::REF_OSD_D"},
                    }}},
            //Section 7, piece counts
            BOL_PLT: {toDisplay: "[BOL_PLT]", toSearch: "BOL_PLT"},
            BOL_PCS: {toDisplay: "[BOL_PCS]", toSearch: "BOL_PCS"},
            BOL_LBS: {toDisplay: "[BOL_LBS]", toSearch: "BOL_LBS"},
            //Section 8 status
            SERVICE_STATUS: {toDisplay: "[Status_Service]", toSearch: "Status_Service"},
            DATE_DELIVERED: {toDisplay: "[DATE_DELIVERED]", toSearch: "DATE_DELIVERED"},
            REC_TIME: {toDisplay: "[POD_RECTIME]", toSearch: "POD_RECTIME"},
            REC_BY: {toDisplay: "[POD_RECBY]", toSearch: "POD_RECBY"},
            //pod image goes here
            COMMENT: {toDisplay: "[Status_Service_Comment]", toSearch: "Status_Service_Comment"},
            //Section 9, modification timestamp
            MODIFICATION_TIMESTAMP: {toDisplay: "[MODIFICATION_TIMESTAMP]", toSearch: "ModificationTimestamp"},
        }

    //New promise to finish looping before return
    const multiSearchPromise = new Promise((resolve, reject) =>
    {
        for(const searchValue of searchArry)
        {
            let database = "LogicBoard"
            let layout = "XML_BOL"
            let toSearch = searchValue;
            let fieldsToSearch = [fieldsToDisplayXML_BOL.RELATED_SETS.XML_REF.valuesInSet.REF_NUMBER.toSearch, //REF number (related set)
                fieldsToDisplayXML_BOL.RELATED_SETS.XML_REF.valuesInSet.REF_PO.toSearch, //PO number (related set)
                fieldsToDisplayXML_BOL.RELATED_SETS.XML_ID.valuesInSet.ID_NUMBER.toSearch, //ID number (related set)
                fieldsToDisplayXML_BOL.BOL_NUMBER.toSearch, //BOL number
                fieldsToDisplayXML_BOL.PRO_NUMBER.toSearch]; //PRO number
            let xmlQuery = generateXMLQuery(toSearch, fieldsToSearch)

            console.log(clc.green(`Beginning search for ${toSearch} at ${Date.now()}`));
            BuildOutputData(database, layout, xmlQuery, fieldsToDisplayXML_BOL, false, toSearch).then(output => {
                outputs.Results.push(output);
                if(outputs.Results.length === searchArry.length)
                    resolve(outputs);
            })
        }
    }).then((outputs) => {
        res.json(outputs) //Sends the results as a json
    });
})

//FUNCTIONS -----------------------

function BuildOutputData(database, layout, searchQuery, fieldsToDisplay, doUploadSignature, searchingFor)
{
    const outputData =
        {
            searchingFor: searchingFor,
            recordsFound: 0,
            errorCode: "",
            records: [], //becomes a json object in code, generated using the fields to display variable + PDF path
        };

    let parsedXML;

    //XML request to the filemaker server, searches for a matching BOL, POD, or PRO #
    const xmlFile = `http://${serverip}/fmi/xml/fmresultset.xml?-db=${database}&-lay=${layout}&${searchQuery}&-findquery`;
    console.log(clc.white(`xml link: ${xmlFile} \n`))

    //HTTP request to get the XML data from FMP's webpublishing engine
    return new Promise( (resolve, reject) => {
        const httpRequest = http.get(xmlFile, fmpAuthentication, function (response) {

            console.log(clc.white('STATUS: ' + response.statusCode + ` \n`));
            console.log(clc.white('HEADERS: ' + JSON.stringify(response.headers) + ` \n`));

            //Grabs the chunks of the XML request
            let bodyChunks = [];
            response.on('data', function (chunk) {
                bodyChunks.push(chunk);
            }).on('end', async function () {
                let body = Buffer.concat(bodyChunks);
                //Uses fast-xml-parser to parse the body data from the http request
                parsedXML = parser.parse(body);
                outputData.errorCode = parsedXML.fmresultset.error.att_code;

                if (parsedXML.fmresultset.error.att_code === '0')
                {
                    //Converts the resultset count to an int
                    outputData.recordsFound = parseInt(parsedXML.fmresultset.resultset.att_count)

                    for (let i = 0; i < outputData.recordsFound; i++)
                    {
                        let record = {};
                        for (const key in fieldsToDisplay)
                        {
                            if(key === "RELATED_SETS")
                            {
                                //The two related sets have special logic, instead of combing through a list we need to check for results on each of the two.
                                //RELATED_SETS are their own datastructures within fieldsToDisplay for the sake of keeping everything together
                                let relatedSetArray = [];
                                if(outputData.recordsFound > 1)
                                    relatedSetArray = parsedXML.fmresultset.resultset.record[i].relatedset;
                                else
                                    relatedSetArray = parsedXML.fmresultset.resultset.record.relatedset;

                                for(const table in fieldsToDisplay.RELATED_SETS) //Loop through the related sets to search
                                {
                                    for(let j = 0; j < relatedSetArray.length; j++)
                                    {
                                        let countAsInt = parseInt(relatedSetArray[j]["att_count"]);

                                        //Confirms count & that we have the related set we're looking for
                                        if(countAsInt > 0 && relatedSetArray[j]["att_table"] === fieldsToDisplay.RELATED_SETS[table].setName)
                                        {
                                            for(const searchValue in fieldsToDisplay.RELATED_SETS[table].valuesInSet)
                                            {
                                                let resultArray = [];
                                                //If there's more than one result, handle with a loop
                                                if(countAsInt > 1)
                                                {
                                                    //
                                                    for(let k = 0; k < relatedSetArray[j].record.length; k++)
                                                    {
                                                        resultArray.push(jsonSearch(relatedSetArray[j].record[k].field,
                                                            "att_name", fieldsToDisplay.RELATED_SETS[table].valuesInSet[searchValue].toSearch));
                                                    }
                                                    let jsonName = fieldsToDisplay.RELATED_SETS[table].valuesInSet[searchValue].toDisplay;
                                                    record[jsonName] = resultArray;
                                                }
                                                else
                                                {
                                                    //If there's only 1, then we can push it into the PDF, else the website will create a list for the user to see
                                                    resultArray.push(jsonSearch(relatedSetArray[j].record.field,
                                                        "att_name", fieldsToDisplay.RELATED_SETS[table].valuesInSet[searchValue].toSearch));

                                                    let jsonName = fieldsToDisplay.RELATED_SETS[table].valuesInSet[searchValue].toDisplay;

                                                    record[jsonName] = resultArray;
                                                }
                                            }
                                        }
                                        else
                                        {
                                            //record[fieldsToDisplay.RELATED_SETS[table].valuesInSet[searchValue].toDisplay] = "N/A"; //TODO: handle better
                                        }
                                    }
                                }
                            }
                            else //The rest of the stuff to display
                            {
                                //Fast FMP parser will only create an array if more 1 record is found, this if tests for that and uses the correct datatype for capturing the record data
                                if(outputData.recordsFound > 1)
                                    record[fieldsToDisplay[key].toDisplay] = jsonSearch(parsedXML.fmresultset.resultset.record[i].field, "att_name", fieldsToDisplay[key].toSearch);
                                else
                                    record[fieldsToDisplay[key].toDisplay] = jsonSearch(parsedXML.fmresultset.resultset.record.field, "att_name", fieldsToDisplay[key].toSearch);
                            }
                        }
                        outputData.records.push(record);
                    }
                    resolve(outputData);
                }
                else
                {
                    resolve(outputData);
                }

            })
        });

    })
}

function jsonSearch(jsonArray, attributeToSearch, resultToSearch)
{
    let returnValue = ""

    if(Array.isArray(jsonArray)) //Checks to see if the passed in value is an array, if not just check the data of what was passed
    {
        for(let i = 0; i < jsonArray.length; i++)
        {
            if(jsonArray[i][attributeToSearch] === resultToSearch)
            {
                returnValue = jsonArray[i].data;
                break;
            }
        }
    }
    else
    {
        if(jsonArray[attributeToSearch] === resultToSearch)
            returnValue = jsonArray.data;
    }

    return returnValue
}

function generateXMLQuery(toSearch, fieldsToSearch)
{
    let xmlQuery = `-query=`; //Start of the search query

    let fieldsQueryFront = '';
    let fieldsQueryBack = '';
    for(let i = 0; i < fieldsToSearch.length; i++)
    {
        fieldsQueryFront += `(q${i + 1})`
        if(i !== fieldsToSearch.length - 1) //Add a ; as long as it's not the last
            fieldsQueryFront += `;`;
        fieldsQueryBack += `&-q${i + 1}=${fieldsToSearch[i]}&-q${i + 1}.value=${toSearch}`
    }
    xmlQuery += fieldsQueryFront + `&` + fieldsQueryBack;
    return xmlQuery;
}