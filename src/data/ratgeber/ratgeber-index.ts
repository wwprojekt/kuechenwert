import type { RatgeberConfig } from "./ratgeber-types";

// Hymer
import { hymerVerkaufen, hymerKosten, hymerWertErmitteln, hymerWieVerkaufe, hymerVersteigern } from "./ratgeber-hymer";
// Dethleffs
import { dethleffsVerkaufen, dethleffsKosten, dethleffsWertErmitteln, dethleffsWieVerkaufe, dethleffsVersteigern } from "./ratgeber-dethleffs";
// Knaus
import { knausVerkaufen, knausKosten, knausWertErmitteln, knausWieVerkaufe, knausVersteigern } from "./ratgeber-knaus";
// Bürstner
import { buerstnerVerkaufen, buerstnerKosten, buerstnerWertErmitteln, buerstnerWieVerkaufe, buerstnerVersteigern } from "./ratgeber-buerstner";
// Carthago
import { carthagoVerkaufen, carthagoKosten, carthagoWertErmitteln, carthagoWieVerkaufe, carthagoVersteigern } from "./ratgeber-carthago";
// Hobby
import { hobbyVerkaufen, hobbyKosten, hobbyWertErmitteln, hobbyWieVerkaufe, hobbyVersteigern } from "./ratgeber-hobby";
// Adria
import { adriaVerkaufen, adriaKosten, adriaWertErmitteln, adriaWieVerkaufe, adriaVersteigern } from "./ratgeber-adria";
// Weinsberg
import { weinsbergVerkaufen, weinsbergKosten, weinsbergWertErmitteln, weinsbergWieVerkaufe, weinsbergVersteigern } from "./ratgeber-weinsberg";
// Carado
import { caradoVerkaufen, caradoKosten, caradoWertErmitteln, caradoWieVerkaufe, caradoVersteigern } from "./ratgeber-carado";
// Sunlight
import { sunlightVerkaufen, sunlightKosten, sunlightWertErmitteln, sunlightWieVerkaufe, sunlightVersteigern } from "./ratgeber-sunlight";
// Pössl
import { poesslVerkaufen, poesslKosten, poesslWertErmitteln, poesslWieVerkaufe, poesslVersteigern } from "./ratgeber-poessl";
// Chausson
import { chaussonVerkaufen, chaussonKosten, chaussonWertErmitteln, chaussonWieVerkaufe, chaussonVersteigern } from "./ratgeber-chausson";
// Rapido
import { rapidoVerkaufen, rapidoKosten, rapidoWertErmitteln, rapidoWieVerkaufe, rapidoVersteigern } from "./ratgeber-rapido";
// Concorde
import { concordeVerkaufen, concordeKosten, concordeWertErmitteln, concordeWieVerkaufe, concordeVersteigern } from "./ratgeber-concorde";
// Laika
import { laikaVerkaufen, laikaKosten, laikaWertErmitteln, laikaWieVerkaufe, laikaVersteigern } from "./ratgeber-laika";

// Condition guides — damage
import { motorschaden, wasserschaden, getriebeschaden, unfallschaden, hagelschaden, schimmel } from "./ratgeber-condition-damage";
// Condition guides — situation
import { ohneTuev, hoheLaufleistung, reparaturstau, leasingvertrag, trotzFinanzierung, erbfall, scheidung } from "./ratgeber-condition-situation";

const allConfigs: RatgeberConfig[] = [
  // Hymer
  hymerVerkaufen, hymerKosten, hymerWertErmitteln, hymerWieVerkaufe, hymerVersteigern,
  // Dethleffs
  dethleffsVerkaufen, dethleffsKosten, dethleffsWertErmitteln, dethleffsWieVerkaufe, dethleffsVersteigern,
  // Knaus
  knausVerkaufen, knausKosten, knausWertErmitteln, knausWieVerkaufe, knausVersteigern,
  // Bürstner
  buerstnerVerkaufen, buerstnerKosten, buerstnerWertErmitteln, buerstnerWieVerkaufe, buerstnerVersteigern,
  // Carthago
  carthagoVerkaufen, carthagoKosten, carthagoWertErmitteln, carthagoWieVerkaufe, carthagoVersteigern,
  // Hobby
  hobbyVerkaufen, hobbyKosten, hobbyWertErmitteln, hobbyWieVerkaufe, hobbyVersteigern,
  // Adria
  adriaVerkaufen, adriaKosten, adriaWertErmitteln, adriaWieVerkaufe, adriaVersteigern,
  // Weinsberg
  weinsbergVerkaufen, weinsbergKosten, weinsbergWertErmitteln, weinsbergWieVerkaufe, weinsbergVersteigern,
  // Carado
  caradoVerkaufen, caradoKosten, caradoWertErmitteln, caradoWieVerkaufe, caradoVersteigern,
  // Sunlight
  sunlightVerkaufen, sunlightKosten, sunlightWertErmitteln, sunlightWieVerkaufe, sunlightVersteigern,
  // Pössl
  poesslVerkaufen, poesslKosten, poesslWertErmitteln, poesslWieVerkaufe, poesslVersteigern,
  // Chausson
  chaussonVerkaufen, chaussonKosten, chaussonWertErmitteln, chaussonWieVerkaufe, chaussonVersteigern,
  // Rapido
  rapidoVerkaufen, rapidoKosten, rapidoWertErmitteln, rapidoWieVerkaufe, rapidoVersteigern,
  // Concorde
  concordeVerkaufen, concordeKosten, concordeWertErmitteln, concordeWieVerkaufe, concordeVersteigern,
  // Laika
  laikaVerkaufen, laikaKosten, laikaWertErmitteln, laikaWieVerkaufe, laikaVersteigern,
  // Condition — damage
  motorschaden, wasserschaden, getriebeschaden, unfallschaden, hagelschaden, schimmel,
  // Condition — situation
  ohneTuev, hoheLaufleistung, reparaturstau, leasingvertrag, trotzFinanzierung, erbfall, scheidung,
];

export const ratgeberPages: Record<string, RatgeberConfig> = Object.fromEntries(
  allConfigs.map((config) => [config.slug, config])
);

export const allRatgeberConfigs = allConfigs;
