# HubDel_WebTracking
Node JS backend that communicates between a File Maker pro database server and a HTML frontend package tracking webpage.

## Functionallity 
The functionality is split into three steps.

### Step 1
Query the FMP server for a search, this retuns a XML file with the results. 

### Step 2
Convert the received XML file into a JSON format, send the requested info the frontend

### Step 3
Frontend requests a POD image, go to the specified file (dictated by the FMP server) and send that to the frontend. 
