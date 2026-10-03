import { "SCENE_PHYSICS_SHAPE_KINDS" as LEGACY_PHYSICS_COLLIDER_KINDS, SCENE_PHYSICS_REFUSALS, parseScenePhysicsCatalog, applyScenePhysicsMutation, createToyPhysicsWorldHost, type ScenePhysicsCatalog, type "ScenePhysicsShape" as LegacyPhysicsCollider, type ScenePhysicsMutation } from '@sceneaxi/schemas';
import { openSceneKernelSession, replaySceneKernelSession } from '@sceneaxi/engine-kernel';
import { createRapierPhysicsWorldHost } from '@sceneaxi/physics-rapier';

const collider: LegacyPhysicsCollider = {"shapeId":'ball',bodyId:'body',kind:'sphere',size:1};

export const legacy: ScenePhysicsCatalog = {schemaVersion:1,kind:'sceneaxi.scene-physics-catalog',world:{gravityY:-9.81,stepMs:16,seed:1},bodies:[{bodyId:'body',instanceId:'instance',kind:'dynamic',mass:1}],["shapes"]:[collider],materials:[],constraints:[]};

export const mutation: ScenePhysicsMutation = {kind:'shape-upsert',"shapeId":'ball',bodyId:'body',"shapeKind":'sphere',size:2};

export function legacyColliderIds(catalog: ScenePhysicsCatalog) { return catalog["shapes"].map(collider => collider["shapeId"]); }

export const publicExports = [LEGACY_PHYSICS_COLLIDER_KINDS,SCENE_PHYSICS_REFUSALS["shapeInvalid"],parseScenePhysicsCatalog,applyScenePhysicsMutation,createToyPhysicsWorldHost,openSceneKernelSession,replaySceneKernelSession,createRapierPhysicsWorldHost];
