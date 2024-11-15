# HubDel_WebTracking
NodeJS server designed to transmit data from HubDelivery's Filemaker Pro server to an external webpage.

Currently grabs the data from FMP as an XML, converts the XML to a Javascript object, grabs the relevant data and creates a new JSON file, then returns that file. 

HTML file grabs makes a request to the Node.js server, then displays the results to the user
