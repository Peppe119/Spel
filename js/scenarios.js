/* De 10 testscenarierna. Varje scenario kör samma filterkod som sidan. */
const base={need:"any",meal:"any",area:"any",day:"any",open:false,who:"any",walk:false,pc:""};
const TESTS=[
 {p:"Amina speaks Arabic, lives alone in Petit-Saconnex. It is Monday morning and she wants a hot lunch in a place for women only.",lang:"ar",f:{need:"meal",meal:"lunch",area:"servette",day:"1",who:"woman"},exp:["femmes"]},
 {p:"Olena speaks Ukrainian and has two small children. Wednesday, near Cornavin station, she needs lunch for the family.",lang:"uk",f:{need:"meal",meal:"lunch",area:"cornavin",day:"3",who:"family"},exp:["parents"]},
 {p:"Marco slept outside and wants a shower on Tuesday morning around Servette. He has no papers.",lang:"es",f:{need:"shower",area:"servette",day:"2",who:"man",walk:true},exp:["pointdeau"]},
 {p:"A student has no health insurance and needs to see a doctor on Wednesday afternoon.",lang:"en",f:{need:"health",day:"3"},exp:["umscom"]},
 {p:"A man in Eaux-Vives wants breakfast at 7:30 on Monday, before work.",lang:"fr",f:{need:"meal",meal:"breakfast",area:"eauxvives",day:"1",who:"man"},exp:["bateau"]},
 {p:"Saturday lunch in the Pâquis, walk-in, no paperwork.",lang:"fr",f:{need:"meal",meal:"lunch",area:"paquis",day:"6",walk:true},exp:["sgs","caravane"]},
 {p:"Sunday lunch near Rue de l'Industrie (Servette).",lang:"en",f:{need:"meal",meal:"lunch",area:"servette",day:"0"},exp:["galerie"]},
 {p:"A family in postal code 1203 has a certificate from their social worker and needs free groceries. Which shop and which day?",lang:"es",f:{need:"groceries",pc:"1203"},exp:["colis-charmilles"]},
 {p:"A man with a dog has nowhere to sleep tonight (Thursday).",lang:"ar",f:{need:"sleep",day:"4",who:"man"},exp:["shelter"]},
 {p:"A woman needs warm clothes urgently on Friday morning, Acacias area.",lang:"uk",f:{need:"clothes",area:"plainpalais",day:"5",who:"woman"},exp:["care","vestiaire"]}
];
