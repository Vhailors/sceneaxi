import { SCENE_PHYSICS_SHAPE_KINDS, SCENE_PHYSICS_REFUSALS, parseScenePhysicsCatalog, applyScenePhysicsMutation, createToyPhysicsWorldHost, type ScenePhysicsCatalog, type ScenePhysicsShape, type ScenePhysicsMutation } from '@sceneaxi/schemas';
import { openSceneKernelSession, replaySceneKernelSession } from '@sceneaxi/engine-kernel';
import { createRapierPhysicsWorldHost } from '@sceneaxi/physics-rapier';
const shape: ScenePhysicsShape = {shapeId:'ball',bodyId:'body',kind:'sphere',size:1};
export const legacy: ScenePhysicsCatalog = {schemaVersion:1,kind:'sceneaxi.scene-physics-catalog',world:{gravityY:-9.81,stepMs:16,seed:1},bodies:[{bodyId:'body',instanceId:'instance',kind:'dynamic',mass:1}],shapes:[shape],materials:[],constraints:[]};
export const mutation: ScenePhysicsMutation = {kind:'shape-upsert',shapeId:'ball',bodyId:'body',shapeKind:'sphere',size:2};
export function legacyShapeIds(catalog: ScenePhysicsCatalog) { return catalog.shapes.map(shape => shape.shapeId); }
export const publicExports = [SCENE_PHYSICS_SHAPE_KINDS,SCENE_PHYSICS_REFUSALS.shapeInvalid,parseScenePhysicsCatalog,applyScenePhysicsMutation,createToyPhysicsWorldHost,openSceneKernelSession,replaySceneKernelSession,createRapierPhysicsWorldHost];
