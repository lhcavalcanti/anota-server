const request = require('request');
const cheerio = require('cheerio');
const async = require('async');
const similarity = require('string-similarity')

module.exports = {
    search : function(qrry, database){
      function compare(a,b){
        if (a.rating < b.rating)
          return -1;
        if(a.rating > b.rating)
          return 1;
        return 0;
      }
      return database.ref('/products').once("value").then((snapshot) => {
          var sch = similarity.findBestMatch(qrry, Object.keys(snapshot.val()))
          console.log(sch.ratings.sort(compare).slice(-20))
          return sch.ratings.sort(compare).slice(-20)
        });
    },
    searchMatch : function(qrry, prod){
        return similarity.findBestMatch(qrry, Object.keys(prod))
    },
    requestList: function(link, uid, date, database) {
        return new Promise((resolve, reject) => {
            request(link, (error, response, html) => {
                if (!error) {
                    let doc = cheerio.load(html);
                    var lid = link.split('=')[1].split('&')[0];
                    // NFe not available
                    if (doc('xNome').text() === "") {
                        waitElement = {
                            uid: uid,
                            link: link,
                            time: date
                        };
                        return database.ref('/waitList/' + lid).set(waitElement).then(() => {
                            console.log("requestList - NFe 404! Link on Wait List.");
                            return resolve("NFe 404 - " + uid + " - " + lid);
                        })
                    } else {
                        var prodName = [];
                        var prod = {};
                        doc('xProd').each(function (i, element) {
                            prodName[i] = doc(this).text().replace(/\.|#|\[|\]|\/|&|\*|%/g, " ")
                            prod[prodName[i]] = {
                                qtd: 0
                            };
                        });
                        doc('cProd').each(function (i, element) {
                            (prod[prodName[i]])["code"] = doc(this).text();
                        });
                        doc('uCom').each(function (i, element) {
                            (prod[prodName[i]])["un"] = doc(this).text();
                        });
                        doc('qCom').each(function (i, element) {
                            (prod[prodName[i]])["qtd"] += parseFloat(doc(this).text());
                        });
                        doc('vUnCom').each(function (i, element) {
                            (prod[prodName[i]])["priceUnit"] = parseFloat(doc(this).text());
                        });

                        var price = module.exports.listPrice(prod);

                        var address = {
                            street: doc('xLgr').text(),
                            num: doc('nro').text(),
                            neighborhood: doc('xBairro').text(),
                            city: doc('xMun').text(),
                            // cod_city: doc('cMun').text(),
                            uf: doc('UF').text(),
                            cep: doc('CEP').text(),
                            // cod_country: doc('cPais').text(),
                            country: doc('xPais').text(),
                            // phone: doc('fone').text(),
                        };

                        metadata = {
                            name: doc('xNome').text(),
                            cnpj: doc('CNPJ').text(),
                            address: address,
                            price: module.exports.roundNum(price),
                            prod: prod,
                            date: doc('dhRecbto').text(),
                            link: link
                        };

                        return saveList(uid, lid, metadata, database).then((result) => {
                            return resolve(result);
                        }, (err) => {
                            return reject(err);
                        });
                    }
                } else { // Error detected
                    console.log("requestList - Error of Request");
                    return reject(error);
                }
            });
        });
    },
    listPrice: function(prod){
        var price = 0;
        Object.keys(prod).forEach((i) => {
            // console.log("%s -> %d", prod[i]["code"], prod[i]["qtd"] * prod[i]["priceUnit"]);
            price += module.exports.roundNum(prod[i]["qtd"] * prod[i]["priceUnit"]);
        });
        return price;
    },

    roundNum: function (num) {
        return parseFloat(num.toFixed(2));
    },

    getBestMarket: function (snapshot, database, marketRef) {
        return new Promise((resolve, reject) => {
            [list, price] = getList(snapshot);
            
            if (list.length > 0) {
                return marketRef.once('value').then(snap => {
                    var bestMarkets = {};
                    var marketPrice = 0;
                    // For each market on DB
                    snap.forEach((market) => {
                        marketPrice = 0;
                        var marketList = market.val().prod;
                        // For each product on the list
                        list.forEach((listProduct) => {
                            var bestProd = module.exports.searchMatch(listProduct.name, marketList);
                            if (bestProd.bestMatch.rating > 0.27){
                                marketPrice +=
                                module.exports.roundNum(marketList[bestProd.bestMatch.target].priceUnit * listProduct.qtd);
                            }
                            else{
                              marketPrice = -Infinity;
                            }
                        });
                        if (marketPrice >= 0) {
                            bestMarkets[market.key] = {
                                price: module.exports.roundNum(marketPrice),
                                name: market.val().name,
                                address: market.val().address.street + ", " + market.val().address.num + ", " +
                                 market.val().address.neighborhood + ", " + market.val().address.uf
                            };
                        }
                    });
                    if (objNotEmpty(bestMarkets)) {
                        return resolve(bestMarkets);
                    } else {
                        return reject(new Error("No Best"));
                    }
                }).catch(() => {
                    return reject(new Error("ERROR"));
                });
            } else {
                return reject(new Error("EmptyList"));
            }
        });
    },

};

function saveList (uid, lid, metadata, database) {
    return new Promise((resolve, reject) => {
        var userListData = {
            cnpj: metadata.cnpj,
            name: metadata.name,
            prod: metadata.prod,
            address: metadata.address,
            date: metadata.date,
            price: metadata.price
        };
        var marketInfo = {
            name: metadata.name,
            address: metadata.address,
            date: metadata.date
        };
        var marketProd = {};
        async.forEach(Object.keys(metadata.prod), (i, element) => {
            marketProd[i] = {
                code: metadata.prod[i].code,
                priceUnit: metadata.prod[i].priceUnit,
                un: metadata.prod[i].un
            }
        });

        database.ref('/users/' + uid + "/" + lid).set(userListData);
        database.ref("/markets/" + metadata.cnpj + "/prod/").update(marketProd);
        database.ref("/markets/" + metadata.cnpj).update(marketInfo);
        database.ref('/waitList/' + lid).remove();

        return database.ref('/products/').once('value').then((snapshot) => {
            var listProd = {};
            async.forEach(Object.keys(metadata.prod), (i, element) => {
                var markets = {};
                if (snapshot.val() !== null) {
                    if (snapshot.val()[i]) {
                        markets = snapshot.val()[i];
                    }
                }
                markets[metadata.cnpj] = true;
                listProd[i] = markets;
            });
            console.log("saveList - NFe OK!");
            userListData["lid"] = lid;
            resolve(userListData);
            return database.ref("/products/").update(listProd);
        });
    });
}

function getList(snapshot) {
    
    var prod = snapshot.prod;
    var list = [];
    var price = 0.0;
    price = snapshot.price;
    async.forEach(Object.keys(prod), (i, element) => {
        list.push({
            name: i,
            qtd: prod[i]["qtd"]
        })
    });
    return [list, price];
}

function objNotEmpty(obj) {
    for (var i in obj) return true;
    return false;
}
