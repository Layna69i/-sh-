/**
 * Retouches globales des shaders de three, appliquées avant toute compilation.
 *
 * Taille physique des sources ponctuelles : l'atténuation en 1/d² est bornée à d = 0,5 m
 * (au lieu de 0,1 m). Une flamme vue à travers du papier de lanterne est une source étendue :
 * sans cette borne, la pierre ou l'enduit à quelques centimètres d'une lanterne virent au blanc
 * (points chauds surexposés), alors qu'à plus de 50 cm rien ne change.
 */
import * as THREE from 'three'

const from = 'float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );'
const to = 'float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.25 );'
if (THREE.ShaderChunk.lights_pars_begin.includes(from)) THREE.ShaderChunk.lights_pars_begin = THREE.ShaderChunk.lights_pars_begin.replace(from, to)
else console.warn('[shaderTweaks] atténuation des lumières : motif introuvable (version de three ?)')
