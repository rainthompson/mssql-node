var express = require('express');
var router = express.Router();
module.exports = router;

//  load the tedious package and then create a Connection and Request object
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;

//  the config JSON object has the connection information to your database
var config = {
  server: "localhost",
  options: {},
  authentication: {
    type: "default",
    options: {
      //rowCollectionOnDone: true,
      userName: "root",
      password: "password",
    }
  }
};

//  connect to the database
var connection = new Connection(config);

//  when the connection is made make a note in the log
connection.on('connect', function (err) {
  console.log((err) ? 'Error: ' + err : 'connected to database');
});

/* GET : Display the home page */
router.get('/', (req, res, next) => {
  //   this is an empty page. The column names and crimes do not need to be displayed
  res.render('index', {
    title: 'Crimes of New York',
    colNames: [], //  leave the table headings empty
    crimes: [] //  not data to display
  });
});

/* GET Display a list of crimes. */
router.post('/', (req, res, next) => {

  //  the count variable will be used to set the row count
  let count = req.body.count | 0;
  count = (count == 0) ? 10 : count;
  executeStatement(res, count);
});
let crimes = [];
//  execute the query
function executeStatement(res, count) {
  //  create a query request
  request = new Request(
    `select top ${count} ComplaintNum, Borough, FromDate, FromTime, OffenseDesc, DescriptionCd, PremiseType` +
    ` from Crime.dbo.NewYork`, (err, rowCount, rows) => {
      if (err) {
        console.log(err);
      }
    });

  //  we need to save a few things in the request object 
  //  they need to be available at the end of the request
  //  this is critical. We start up the query and then leave
  //    the call back function will wake up some time in the future 
  //    it will need to know a few things in order to ultimately respond to the browser request
  request.res = res; //  this is the web page response 
  request.crimes = []; //  this will be the list of crimes once the query is complete

  //  when the rows are returned one by one this event 'row' will be invoked
  //    on the event that a row is returned.....
  request.on('row', row => {
    let colNames = row.map(column => column.metadata.colName); //  get the column names
    request.colNames = colNames; //  save in the data request object
    let crimeAr = row.map(column => column.value); //  get the data values for each row

    //  create a Crime 
    let FromDate = new Date(crimeAr[2]);
    request.crimes.push(new Crime(crimeAr[0], crimeAr[1], FromDate, crimeAr[3], crimeAr[4], crimeAr[5], crimeAr[6], crimeAr[7]));
  });

  //  when the request finishes THEN we can finally render the page
  request.on('doneInProc', function (rowCount, more, rows) {
    request.res.render('index', {
      title: 'Crimes of New York',
      crimes: this.crimes,
      colNames: this.colNames
    });
  });

  //  all the way down here we finally issue the sql command to the database
  connection.execSql(request);
}

//-----------------------------------------------------------------------------
//  This block code will 
//      respond to the GET request to display a particular Crime
//    and
//      process the SELECT from the database
//-----------------------------------------------------------------------------

/* GET Display the List of Crimes page. */
router.get('/display/:id', (req, res, next) => {
  let id = req.params.id | 0;
  selectStatement(res, id)
});

//  execute the query
function selectStatement(res, id) {
  //  create a query request
  let sqlSelect = `select ComplaintNum, Borough, FromDate, FromTime, OffenseDesc, DescriptionCd, PremiseType from Crime.dbo.NewYork where ComplaintNum = ${id}`;
  request = new Request(sqlSelect, (err, rowCount, rows) => {
    if (err) {
      console.log(err);
    }
  });

  //  we need to save a few things in the request object 
  //  they need to be available at the end of the request
  //request.res = res; //  this is the web page response 

  //  when the rows are returned one by one this event will be invoked
  request.on('row', row => {
    let colNames = row.map(column => column.metadata.colName); //  get the column names
    request.colNames = colNames; //  save in the data request object
    let crimeAr = row.map(column => column.value); //  get the data values for each row

    //  create a Crime 
    request.crime = new Crime(crimeAr[0], crimeAr[1], crimeAr[2], crimeAr[3], crimeAr[4], crimeAr[5], crimeAr[6], crimeAr[7]);
  });

  //  when the request finishes THEN we render the page
  request.on('doneInProc', function (rowCount, more, rows) {
    res.render('details', {
      title: 'Crimes of New York',
      crime: this.crime,
      colNames: this.colNames
    });
  });
  connection.execSql(request);
}

//-----------------------------------------------------------------------------
//  This block code will 
//      respond to the GET request to display the CREATE page
//      respond to the POST request to process the CREATE page
//    and
//      process the insert into the database
//-----------------------------------------------------------------------------

/* GET Display the Create a Crime page. */
router.get('/create', (req, res, next) => {
  res.render('create', {
    title: 'Crimes of New York'
  });
});

/* POST -- Process the Crime data */
router.post('/create', (req, res, next) => {
  //  take the data from the web page and create a crime object
  let FromTime = new Date('1/1/2001 ' + req.body.FromTime);

  let crime = new Crime(req.body.ComplaintNum, req.body.FromDate, FromTime, req.body.OffenseDesc, req.body.DescriptionCd, req.body.Borough, req.body.PremiseType);
  insertStatement(res, crime);
});

//  execute the insert
function insertStatement(res, crime) {
  //  create an insert statement
  let sqlInsert = `insert into Crime.dbo.NewYork ` +
    ` (ComplaintNum, FromDate, FromTime, OffenseDesc, DescriptionCd, Borough, PremiseType) ` +
    ` values (${crime.ComplaintNum},  '${crime.FromDate}',   '${crime.FromTime}', '${crime.OffenseDesc}',` +
    ` '${crime.DescriptionCd}', '${crime.Borough}', '${crime.PremiseType}')`;

  request = new Request(sqlInsert, (err, rowCount, rows) => {
    if (err)
      console.log(`Error on Insert: ${err}`);
    else
      res.render('index', {
        title: `Crime# ${request.crime.ComplaintNum} has been added`,
        colNames: ['Thank you for using Texas James Gang Consulting and Training'],
        crimes: []
      });
  });

  //  Finally after everything has been prepared to handle the completing of the insert
  //  we will finally DO the insert
  connection.execSql(request);
}

//  Crime object
class Crime {
  constructor(ComplaintNum, Borough, FromDate, FromTime, OffenseDesc, DescriptionCd, PremiseType) {
    this.ComplaintNum = ComplaintNum;
    this.FromDate = formatDate(FromDate);
    this.FromTime = formatTime(FromTime);
    this.OffenseDesc = OffenseDesc;
    this.DescriptionCd = DescriptionCd;
    this.Borough = Borough;
    this.PremiseType = PremiseType;
  }
}

//    need to clean up the date a little
function formatDate(dt) {
  let date = new Date(dt);
  let month = date.getMonth() + 1;
  let day = date.getDate();
  day = day < 10 ? '0' + day : day;
  return month + "/" + day;
}

//    need to clean up the time a little
function formatTime(time) {
  let hours = time.getHours();
  let minutes = time.getMinutes();
  let ampm = hours >= 12 ? 'pm' : 'am';

  hours %= 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0' + minutes : minutes;

  let strTime = hours + ':' + minutes + ' ' + ampm;
  return strTime;
}