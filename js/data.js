/* Tjänster, källor och områden. Uppdatera här när öppettider ändras. */
const CHECKED = "22.10.2026";
const SRC = {
  feuillet:{url:"https://www.geneve.ch/document/feuillet-lieux-accueil-urgence-juillet-2026",name:"Ville de Genève – Lieux d'accueil d'urgence",date:"07.2026"},
  repas:{url:"https://www.geneve.ch/themes/social/precarite-abri/repas-gratuits-accueil-jour",name:"Ville de Genève – Repas gratuits et accueil de jour",date:"04.06.2026"},
  hyg:{url:"https://www.geneve.ch/themes/social/precarite-abri/soins-hygiene-vetements-gratuits",name:"Ville de Genève – Soins d'hygiène et vêtements gratuits",date:"01.10.2025"},
  colis:{url:"https://colisducoeur.ch/",name:"Fondation Colis du Cœur",date:"01.05.2026"},
  heb:{url:"https://www.geneve.ch/themes/social/precarite-abri/hebergements-urgence/dispositif-ville-geneve",name:"Ville de Genève – Hébergement d'urgence",date:"2026"},
  carto:{url:"https://www.ge.ch/document/35279/telecharger",name:"État de Genève – Cartographie de l'aide alimentaire",date:"02.2024"}
};
const ALLPC=[1205,1206,1207,1208,1239,1242,1281,1283,1288,1290,1293,1294,1298,1214,1216,1217,1219,1220,1203,1202,1204];
const MF=[1,2,3,4,5];
// k: breakfast|lunch|dinner|snack|shower|laundry|clothes|health|groceries|sleep|advice
const S=[
 {id:"club",name:"Club social rive gauche",org:"Ville de Genève",area:"plainpalais",addr:"Rue Hugo-de-Senger 4, 1205 Genève",access:"ticket",aud:"all",src:["feuillet","repas"],
  notes:["ticketSite","takeawaySat"],sch:[{d:MF,k:"breakfast",t:["08:00","09:15"]},{d:MF,k:"lunch",t:["11:00","14:00"],x:"11h · 12h · 13h"},{d:[6],k:"lunch",t:["11:00","12:00"]},{d:[0],k:"lunch",t:["11:00","14:00"],x:"11h · 12h · 13h"}]},
 {id:"care",name:"Le CARÉ",org:"Caritas Accueil Rencontres Échanges",area:"plainpalais",addr:"Rue du Grand-Bureau 13, 1227 Les Acacias",access:"walkin",aud:"all",src:["feuillet","hyg"],
  notes:["closed3rdThu","clothesReq","winterCare"],sch:[
   {d:[1,2,3,4,5],k:"breakfast",t:["08:40","10:00"],x:"brunch"},{d:[1,2,3,4,5],k:"lunch",t:["12:00","13:00"]},{d:[1,2,3,5],k:"snack",t:["13:30","15:00"],x:"brunch"},
   {d:[1,2,3,4,5],k:"shower",t:["08:40","10:40"]},{d:[1,2,3,5],k:"shower",t:["13:30","15:30"]},
   {d:[1,2,3,4,5],k:"clothes",t:["08:40","10:40"]},{d:[1,2,3,5],k:"clothes",t:["13:30","15:30"]}]},
 {id:"montbrillant",name:"Jardin de Montbrillant & Bus Car Touche",org:"Carrefour-Rue",area:"cornavin",addr:"Rue de Montbrillant 3, 1201 Genève",access:"walkin",aud:"all",src:["feuillet","repas"],
  notes:["firstSun"],sch:[{d:[2,3],k:"breakfast",t:["09:00","11:00"]},{d:[2,3,4,5,6],k:"lunch",t:["11:00","12:30"]},{d:[0],k:"lunch",t:["11:00","12:30"],n:"firstSun"}]},
 {id:"bateau",name:"Le Bateau Genève",org:"Association Le Bateau Genève",area:"eauxvives",addr:"Quai Gustave-Ador, 1207 Genève",access:"walkin",aud:"all",src:["feuillet","repas"],
  notes:["twiceMonth"],sch:[{d:MF,k:"breakfast",t:["07:30","09:30"]},{d:[1,4],k:"lunch",t:["10:00","11:00"],x:"repas chaud"},{d:[2,3,5],k:"snack",t:["09:30","11:00"]},{d:[0],k:"dinner",t:["17:00","19:30"],n:"twiceMonth"}]},
 {id:"restoscout",name:"Resto'Scout",org:"Scouts genevois",area:"servette",addr:"Rue de l'Industrie 13, 1201 Genève",access:"walkin",aud:"all",src:["feuillet","repas"],
  notes:["twiceMonth"],sch:[{d:[0],k:"dinner",t:["17:00","19:30"],n:"twiceMonth"}]},
 {id:"galerie",name:"La Galerie",org:"",area:"servette",addr:"Rue de l'Industrie 13, 1201 Genève",access:"walkin",aud:"all",src:["feuillet","repas"],
  notes:[],sch:[{d:[0],k:"lunch",t:["12:00","13:00"]}]},
 {id:"parents",name:"Espace Parents-Enfants de Saint-Gervais",org:"Ville de Genève",area:"cornavin",addr:"Rue du Temple 8-10, 1201 Genève",access:"walkin",aud:"families",src:["feuillet","repas"],
  notes:["familiesNote"],sch:[{d:MF,k:"lunch",t:["12:00","13:00"],x:"12h"}]},
 {id:"phare",name:"Le Phare",org:"Armée du Salut",area:"servette",addr:"Rue Jean-Jacques-de-Sellon 3, 1201 Genève",access:"walkin",aud:"all",src:["feuillet"],
  notes:["phareTickets"],sch:[{d:[2,4],k:"snack",t:["10:00","14:00"],x:"café · soupe"},{d:[5],k:"lunch",t:["10:00","14:00"],x:"café · soupe · repas"},{d:[6],k:"breakfast",t:["09:00","11:30"]}]},
 {id:"sgs",name:"SGS Solidarité Pâquis",org:"",area:"paquis",addr:"Place de la Navigation, 1201 Genève",access:"walkin",aud:"all",src:["feuillet"],
  notes:[],sch:[{d:[6],k:"lunch",t:["12:00","13:00"],x:"12h"}]},
 {id:"caravane",name:"Caravane de solidarité",org:"",area:"paquis",addr:"Rue de la Navigation 19, 1201 Genève",access:"walkin",aud:"all",src:["feuillet","repas"],
  notes:["adviceCaravane"],sch:[{d:[6],k:"lunch",t:["12:00","13:00"],x:"repas chaud 12h"},{d:MF,k:"advice",t:["15:00","19:00"]}]},
 {id:"refettorio",name:"Refettorio Geneva",org:"",area:"servette",addr:"Rue de Lyon 120, 1203 Genève",access:"ticket",aud:"all",src:["feuillet"],
  notes:["refTickets"],sch:[{d:MF,k:"lunch",t:["12:00","13:30"]},{d:MF,k:"dinner",t:["18:00","19:30"],x:"18h"}]},
 {id:"femmes",name:"Femmes à Bord",org:"",area:"servette",addr:"Avenue de Riant-Parc 23, 1209 Genève",access:"walkin",aud:"women",src:["feuillet","repas"],
  notes:["noChildren"],sch:[{d:[1,4],k:"lunch",t:["10:30","14:30"]},{d:[2],k:"snack",t:["14:00","17:00"]}]},
 {id:"pointdeau",name:"Point d'Eau",org:"Carrefour-Rue",area:"servette",addr:"Rue de Vermont 21, 1202 Genève",access:"walkin",aud:"all",src:["feuillet","hyg"],
  notes:["womenPM","healthMonthly"],sch:[{d:MF,k:"shower",t:["08:00","13:00"]},{d:[2,3,5],k:"shower",t:["14:00","16:00"]},{d:[1,4],k:"shower",t:["14:00","16:00"],w:true},
   {d:MF,k:"laundry",t:["08:00","13:00"]},{d:[2,3,5],k:"laundry",t:["14:00","16:00"]},{d:[1,4],k:"laundry",t:["14:00","16:00"],w:true}]},
 {id:"umscom",name:"UMSCOM – HUG",org:"Hôpitaux universitaires de Genève",area:"plainpalais",addr:"Rue Hugo-de-Senger 4, 1205 Genève",access:"walkin",aud:"all",src:["feuillet"],
  notes:["noIns"],link:"https://www.hug.ch/medecine-premier-recours/consultation-umscom-rdv-en-ligne",sch:[{d:[1,2,4,5],k:"health",t:["08:30","11:00"]},{d:[3],k:"health",t:["13:30","16:00"]}]},
 {id:"colis-blavignac",name:"ColiShop de Blavignac",org:"Fondation Colis du Cœur",area:"carouge",addr:"Rue Blavignac 16, 1227 Carouge",access:"referral",aud:"all",src:["colis"],
  notes:["colisRef","colisPc"],sch:[{d:[2],k:"groceries",t:["13:00","19:00"],pc:"other"},{d:[4],k:"groceries",t:["13:00","19:00"],pc:[1205,1206,1207,1208,1239,1242,1281,1283,1288,1290,1293,1294,1298]}]},
 {id:"colis-charmilles",name:"ColiShop des Charmilles",org:"Fondation Colis du Cœur",area:"servette",addr:"Rue des Charmilles 23, 1203 Genève",access:"referral",aud:"all",src:["colis"],
  notes:["colisRef","colisPc"],sch:[{d:[2],k:"groceries",t:["13:00","19:00"],pc:[1202,1204]},{d:[3],k:"groceries",t:["13:00","19:00"],pc:[1203]},{d:[4],k:"groceries",t:["13:00","19:00"],pc:[1214,1216,1217,1219,1220]}]},
 {id:"shelter",name:"Centrale d'hébergement d'urgence",org:"Ville de Genève",area:"all",addr:"",phone:"0800 22 22 10",access:"phone",aud:"all",dogs:true,src:["feuillet","heb"],
  notes:["max30","dogs"],sch:[{d:MF,k:"sleep",t:["10:30","20:00"]},{d:[0,6],k:"sleep",t:["15:00","20:00"]}]},
 {id:"vestiaire",name:"Vestiaire social",org:"CSP · Caritas Genève · Croix-Rouge genevoise",area:"all",addr:"",access:"referral",aud:"all",src:["hyg"],link:"https://vestiairesocial.ch/",
  notes:["voucher"],needs:["clothes"],sch:null}
];
const MEALK=["breakfast","lunch","dinner","snack"];
const needOf=k=>MEALK.includes(k)?"meal":k;
const NEEDS=["any","meal","groceries","shower","laundry","clothes","health","sleep","advice"];
const AREAS=["any","plainpalais","paquis","cornavin","eauxvives","servette","carouge"];
const AREAN={plainpalais:"Plainpalais – Acacias",paquis:"Pâquis – Navigation",cornavin:"Cornavin – Grottes – Saint-Gervais",eauxvives:"Eaux-Vives",servette:"Servette – Charmilles – Petit-Saconnex",carouge:"Carouge"};
