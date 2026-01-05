//Dev toggles, all should be set to true before publishing
let doHide= true;
let doHideDebugOnFinish = true;

//Code snippet for easy copy / paste
//document.getElementById("ErrorMsg").textContent = "";

// Sets up and retrieves the XML file
function getResults()
{
    var serverLink = "https://podtracking.hubdelivery.com:3000/GetSearchInfo?searchfor=" + document.getElementById("usrSearchInput").value;
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", serverLink, true);
    xhttp.send();

    document.getElementById("ErrorMsg").textContent = "Loading please wait";
    xhttp.onreadystatechange = function()
    {
        if (this.readyState === 4 && this.status === 200)
        {
            let jsonFile = JSON.parse(xhttp.responseText);

            document.getElementById("ErrorMsg").textContent = "Found, generating report";
            let printOptions = document.getElementById("printOptions");
            document.getElementById("printSection").classList.remove('hidden');

            for(let i = 0; i < jsonFile.Results.length; i++)
            {
                let searchingFor = jsonFile.Results[i].searchingFor
                //Checks to see if there was an error
                if(jsonFile.Results[i].errorCode === "0")
                {
                    //Gets the div of the template on the webpage
                    let resultsTemplate = document.querySelector('#resultTable');
                    let newResultTable = resultsTemplate.cloneNode(true);
                    newResultTable.id = `result ${searchingFor}`;
                    let idResults = {};
                    let refResults = {};
                    let keysToHide = {};

                    for(const key in jsonFile.Results[i].records[0])
                    {

                        if(key.includes("ID")) //ID and REF needs extra logic
                        {
                            idResults[key] = jsonFile.Results[i].records[0][key];
                        }
                        else if(key.includes("REF"))
                        {
                            refResults[key] = jsonFile.Results[i].records[0][key];
                        }
                        else if(!key.includes("pdfPath"))
                        {
                            let toReplace = jsonFile.Results[i].records[0][key];
                            if(/\s/.test(toReplace))
                            {
                                toReplace.replaceAll(' ', '');
                            }

                            let keyID = key;
                            //Remove HTML elements used in the xml search and add the # for the query selector
                            keyID = keyID.replace("]", "");
                            keyID = keyID.replace("[", "");
                            keyID = `#${keyID}`;

                            let cell = newResultTable.querySelector(keyID);

                            if(toReplace !== '')
                            {
                                cell.textContent = toReplace;
                            }
                            else
                            {
                                keysToHide[keyID] = cell;
                                cell.textContent = "";
                            }
                        }
                    }

                    //Extra logic for ID and REF related fields, function loops through all the fields and creates a row for each result
                    //Populate ID rows
                    if(Object.keys(idResults).length > 0)
                    {
                        addRow(jsonFile.Results[i].records[0], idResults, jsonFile.Results[i].records[0]["[ID_NUMBER]"].length,
                            newResultTable.querySelector('#ID_ROW'));
                    }
                    else
                    {
                        //If there's no values for this, hide the header
                        newResultTable.querySelector('#ID_Table').classList.add('hidden');
                    }
                    //Populate REF rows
                    if(Object.keys(refResults).length  > 0)
                    {
                        addRow(jsonFile.Results[i].records[0], refResults, jsonFile.Results[i].records[0]["[REF_NUMBER]"].length,
                            newResultTable.querySelector('#REF_ROW'));
                    }
                    else
                    {
                        //If there's no values for this, hide the header
                        newResultTable.querySelector('#REF_Table').classList.add('hidden');
                    }

                    checkAndHideCells(keysToHide);

                    //Get the POD img from the server
                    let podImgPath = `${jsonFile.Results[i].records[0]["[DATE_SHIPPED]"]}/${jsonFile.Results[i].records[0]["[PRO_NUMBER]"]}`
                    newResultTable.querySelector('#POD_IMG_FIELD').src = `https://podtracking.hubdelivery.com:3000/GetPODImg?searchfor=${podImgPath}`;

                    newResultTable.classList.remove('hidden');
                    resultsTemplate.after(newResultTable);

                    //Builds the print options from the found results
                    let newOption = document.createElement("option");
                    newOption.innerText = searchingFor;
                    newOption.id = `printOption_${searchingFor}`;
                    newOption.value = `result ${searchingFor}`;
                    printOptions.appendChild(newOption);
                    printOptions.value = newOption.value;
                }
                else
                {
                    let errorMessageField = document.getElementById("ErrorMsg")
                    let errorMessage = `Failed to find ${jsonFile.Results[i].searchingFor}, error code ${jsonFile.Results[i].errorCode}`;
                    let lineBreak = document.createElement("br")
                    errorMessageField.after(lineBreak);
                    errorMessageField.after(errorMessage);
                    errorMessageField.textContent = "";
                }
            }

            if(jsonFile.Results.length> 1) //only display the option to print specific results if there is more than one
            {
                document.getElementById("printOptionsDiv").classList.remove('hidden');
            }

            if(doHideDebugOnFinish)
                document.getElementById("ErrorMsg").textContent = "";
        }

    };
}

//Loops through a given table template and adds rows with the desired data
function addRow(dataJson, fieldsToReplace, numberOfRows, rowTemplate)
{
    for(let j = 0; j < numberOfRows; j++)
    {
        let newROW = rowTemplate.cloneNode(true);
        let toHide = {};
        for(const key in fieldsToReplace)
        {
            let toReplace = dataJson[key][j];
            if(/\s/.test(toReplace))
            {
                toReplace.replaceAll(' ', '');
            }

            let keyID = key;
            //Remove HTML elements used in the xml search and add the # for the query selector
            keyID = keyID.replace("]", "");
            keyID = keyID.replace("[", "");
            keyID = `#${keyID}`;

            let cell = newROW.querySelector(keyID);
            cell.setAttribute("id", `${cell.id} ${j}`); //changes the id to make sure each cell has a unique id
            if(toReplace !== '')
            {
                cell.textContent = toReplace;
            }
            else
            {
                toHide[cell.id] = cell;
                cell.textContent = "";
            }
        }
        newROW.classList.remove('hidden');
        rowTemplate.after(newROW)
        checkAndHideCells(toHide);
    }
}

//Checks for a parameter given by the URL
function determineSearchParameters()
{
    var urlParams = new URLSearchParams(window.location.search);
    var hasParam = urlParams.has('Search')  || urlParams.has('search') || urlParams.has('SEARCH');

    if(hasParam)
    {
        //If one of these is present, search the result
        urlParams.forEach((value, key) =>
        {
            //Semi redundant but makes sure no other params are taken
            if(key === 'Search' || key === 'search' || key === 'SEARCH')
            {
                document.getElementById("usrSearchInput").value = value; //Sets the search field to the param found
                getResults();
            }
        });
    }
}

function removeOptions(selectElement)
{
    var i, L = selectElement.options.length - 1;
    for(i = L; i >= 0; i--) {
        selectElement.remove(i);
    }
}

function checkAndHideCells(keysToHide)
{
    if(doHide)
    {
        //Loop through the to hide list and add the hidden tag to the appropriate element
        for(const key in keysToHide)
        {

            let keyTR = keysToHide[key].parentNode;

            let hasTH = keyTR.getElementsByTagName("th").length > 0;
            let hasTD = keyTR.getElementsByTagName("td").length > 0;

            if(hasTH && hasTD)
            {
                //Is a row
                hideEmptyRow(keysToHide[key], keyTR);
            }
            else if(hasTD && !hasTH)
            {
                //Is a col
                hideEmptyColumn(keysToHide[key], keyTR.parentNode, keyTR);
            }
        }
    }

}

function hideEmptyColumn(toHide, table, tr)
{
    //Step 1: Figure out what column needs to be checked
    //  This can be done by finding the index of the cell within the TR's children
    //Step 2: Determine if other cells in that column is empty
    //  Check the other cells at the index across all the rows in the table
    //Step 3: Hide the column
    //  Add the hidden class to each of the cells AND header

    let cellArray = [];
    let trArray = table.querySelectorAll('tr');
    let rowCells = tr.querySelectorAll('td');
    let cellIndex = 0;
    let isEmpty = true;

    for(let i = 0; i < rowCells.length; ++i)
    {
        if(rowCells[i].id === toHide.id)
            cellIndex = i;
    }

    for(let i = 0; i < trArray.length; ++i)
    {
        if(!trArray[i].classList.contains('hidden'))
        {
            let row = trArray[i].querySelectorAll('td');
            if(row.length > 0)
            {

                if(row[cellIndex].textContent === "")
                    cellArray.push(row[cellIndex]);
                else
                    isEmpty = false;
            }
        }
    }

    if(isEmpty)
    {
        for(let i = 0; i < cellArray.length; ++i)
        {
            cellArray[i].classList.add('hidden');
            trArray[0].querySelectorAll('th')[cellIndex].classList.add('hidden'); //makes sure the header (always the first row in this context) is also hidden
        }
    }
}

function hideEmptyRow(toHide, row)
{
    //Checks the contents of the row's <td> cells to see if they have content

    let rowContents = row.querySelectorAll('td');
    let isEmpty = true;

    for(let i = 0; i < rowContents.length; ++i)
    {
        if(rowContents[i].textContent !== "")
            isEmpty = false;
    }

    if(isEmpty)
        row.classList.add('hidden');
}

function printTables()
{

    //let toPrint = document.getElementById("resultTable");
    let newWindow = window.open("");
    let resultStyle = document.getElementById("StyleSheet").cloneNode(true);
    newWindow.document.write('<html><head> <link rel="stylesheet" href="PackageTracking.css" media="print" /> </head> <body></body> </html>');

    let printList = document.getElementById("printOptions");
    if(printList.value === "All")
    {
        //Print all
        for(let i = 0; i < printList.options.length; i++)
        {
            if(printList.options[i].textContent !== "All")
            {
                let toPrint = document.getElementById(printList.options[i].value).cloneNode(true);
                newWindow.document.body.append(toPrint);
            }
        }
    }
    else
    {
        //Print selected value
        let toPrint = document.getElementById(printList.value).cloneNode(true);
        newWindow.document.body.append(toPrint);
    }
    //Setting a small timeout fixes an error in chrome that causes it to print before being appended
    setTimeout(() => {
            newWindow.print();
            newWindow.close();
        } , 100);

}
