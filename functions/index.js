

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions


const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

const request = require('request');
const cheerio = require('cheerio');
const async = require('async');

var database = admin.database();


exports.getBestMarkets = functions.https.onRequest((req, res) => {
  const uid = req.query.uid;

  return database.ref('/users/' + uid).once('value').then( (snapshot) => {
    return res.status(200).send(snapshot.val().bestMarkets);
  });
});

exports.addList = functions.https.onRequest((req, res) => {
    // Grab the text parameter.
    const uid = req.query.uid;
    const link = req.query.link;
    var now = new Date();
    requestList(link, uid, now.toJSON(), res);
});

function requestList(link, uid, date, res) {
    request(link, (error, response, html) => {
        if (!error) {
            let doc = cheerio.load(html);

            // when cant get NFe
            if(doc('xNome').text()==""){
              waitElement = {
                  link: link,
                  time: date
              };
              return admin.database().ref('/waitList/' + uid).set(waitElement).then(() =>{
                return res.status(404).send("Note not found! Link added on Wait List.");
              })
            }

            var prodName = [];
            var prod = {};
            doc('xProd').each(function (i, element) {
                prodName[i] = doc(this).text().replace(/\/|&|\*|%/g, " ");
                prod[prodName[i]] = {
                    // name: doc(this).text()
                  };
                });
      doc('cProd').each(function (i, element) {
        (prod[prodName[i]])["code"] = doc(this).text();
      });
      doc('uCom').each(function (i, element) {
        (prod[prodName[i]])["un"] = doc(this).text();
      });
      doc('qCom').each(function (i, element) {
        (prod[prodName[i]])["qtd"] = doc(this).text();
      });
      doc('vUnCom').each(function (i, element) {
        (prod[prodName[i]])["priceUnit"] = doc(this).text();
      });

      metadata = {
        name: doc('xNome').text(),
        fantasyName: doc('xFant').text(),
        prod: prod,
        date: date
      };

      return saveList(uid, metadata, res);

    } else {
          //  console.log("request error");
          return error;
        }
    });
}

function saveList(uid, metadata, res) {
    var listData = {
        name: metadata.name,
        prod: metadata.prod,
        date: metadata.date
    };
    var listAtt = {
        name: metadata.name,
        date: metadata.date
    };
    
    database.ref('/users/' + uid + "/" + metadata.fantasyName).set(listData);
    database.ref("/markets/" + metadata.fantasyName + "/prod/").update(listData.prod);
    database.ref("/markets/" + metadata.fantasyName).update(listAtt);
    database.ref("/waitList/" + uid).remove();
        
    return database.ref('/products/').once('value').then( (snapshot) => {
        var listProd = metadata.prod;
        async.forEach(Object.keys(metadata.prod), (i, element) => {
            var markets = {};
            if (snapshot.val() !== null){
                if(snapshot.val()[i]) {
                    if (snapshot.val()[i]["markets"])
                        markets = snapshot.val()[i]["markets"];
                }
            }
            markets[metadata.fantasyName] = true;
            listProd[i]["markets"] = markets;
        });
        database.ref("/products/").update(listProd);
        return res.status(200).send("OK");
    });
    
}   
//Teste Local
//http://localhost:5000/anota-backend/us-central1/addList?uid=12345&link=http://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe?chNFe=26180421920821000116650050000111779051519177&nVersao=100&tpAmb=1&dhEmi=323031382D30342D32345431343A33343A31342D30333A3030&vNF=68.23&vICMS=3.17&digVal=&cIdToken=000001&cHashQRCode=BFFC6C762A27D77FF8C8B8FDB6B83C6296F6014F
//http://localhost:5000/anota-backend/us-central1/addList?uid=12345&link=http://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe?chNFe=26180406057223027967650100000196741100418351&nVersao=100&tpAmb=1&dhEmi=323031382d30342d32395431303a32333a34322d30333a3030&vNF=663.96&vICMS=71.81&digVal=2f4e314952456f7149353159793352596972627664654e78574a413d&cIdToken=000001&cHashQRCode=3957073cfcd84f6ebb36718f179b3f65cf38f881


exports.updateBestMarkets = functions.database.ref('/users/{pushId}/{market}')
.onCreate((snapshot, context) => 
{

  [list, price] = getList(snapshot);
  getBestMarket(list, price, snapshot);
  return true;

});

getBestMarket = (list, price, snapshot) =>{
  var bestMarkets = [];
  markets = database.ref('markets/').once('value').then(snap => {
    marketPrice = 0;  
    snap.forEach( market => {
      marketPrice = 0;
      var haveAllProducts = true;
      var name = market.val().name;
      var prodFullList = market.val().prod;

      list.forEach( (targetProduct, index) =>{        
        if(prodFullList[targetProduct.name]) {
          marketPrice += prodFullList[targetProduct.name].priceUnit*targetProduct.qtd;
        } 
        else {
          marketPrice = -Infinity;
        }
      });
      if(marketPrice >= 0) {
        bestMarkets.push({
          name: name,
          price: marketPrice
        });  
      }
    });
    if(bestMarkets) {
      bestMarkets.sort((a, b)=>{
        return a.price > b.price;
      });
      return snapshot.ref.child('bestMarkets').set(bestMarkets);  
    }
    return true;
  });
}


let getList = (snapshot) => {
  var prod = snapshot.val().prod;
  var list = [];
  var price = 0.0;
  if (prod) 
  {
    for(var product in prod) 
    {
      list.push(
      {
        name: product,
        qtd: parseFloat(prod[product].qtd)
      });

      itemPrice = parseFloat(prod[product].priceUnit) * parseFloat(prod[product].qtd);
      price += itemPrice
    }
  }
  
  return [list,price]
};
