/** Admitted offline workshop-bay template: existing scene-composition golden inputs.
 * Deliberate fixed seeds are reconstruction inputs, never provider evidence.
 */
import { composeScene, reconstructSculpt } from "@sceneaxi/authoring-core";

const INTAKE = {
  "schemaVersion": 1,
  "kind": "sceneaxi.scene-composition-intake",
  "sceneId": "workshop-bay",
  "rootInstanceId": "bay-service-crate",
  "placements": [
    {
      "instanceId": "bay-service-crate",
      "artifactId": "service-crate-artifact",
      "parentInstanceId": null,
      "transform": {
        "translation": [
          0,
          0,
          0
        ],
        "rotationEulerDegrees": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      }
    },
    {
      "instanceId": "bay-stacked-crate",
      "artifactId": "service-crate-artifact",
      "parentInstanceId": "bay-service-crate",
      "transform": {
        "translation": [
          0,
          1.5,
          0
        ],
        "rotationEulerDegrees": [
          0,
          0,
          0
        ],
        "scale": [
          0.75,
          0.75,
          0.75
        ]
      }
    },
    {
      "instanceId": "bay-field-drone",
      "artifactId": "field-drone-artifact",
      "parentInstanceId": "bay-stacked-crate",
      "transform": {
        "translation": [
          0.5,
          2,
          -0.5
        ],
        "rotationEulerDegrees": [
          0,
          30,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      }
    }
  ]
};

const SOURCES = [
  {
    "intake": {
      "schemaVersion": 1,
      "kind": "sceneaxi.sculpt-intake",
      "intakeId": "service-crate",
      "mode": "structured-spec",
      "structuredSpec": {
        "schemaVersion": 1,
        "kind": "sceneaxi.object-sculpt-spec",
        "id": "service-crate",
        "rootNodeId": "crate-body-node",
        "complexityClass": "non-trivial",
        "passes": [
          {
            "id": "blockout",
            "deterministic": true,
            "steps": [
              "block-primary-case",
              "set-lid-profile"
            ]
          },
          {
            "id": "structure",
            "deterministic": true,
            "steps": [
              "place-lid",
              "place-latch",
              "place-handles"
            ]
          },
          {
            "id": "materials",
            "deterministic": true,
            "steps": [
              "assign-painted-steel",
              "assign-rubber",
              "assign-emissive-accent"
            ]
          },
          {
            "id": "surface-detail",
            "deterministic": true,
            "steps": [
              "bevel-case-edges",
              "recess-latch"
            ]
          },
          {
            "id": "sockets",
            "deterministic": true,
            "steps": [
              "bind-lid-hinge",
              "bind-carry-point"
            ]
          }
        ],
        "detailInventory": {
          "silhouetteFeatures": [
            "raised-lid-rim",
            "paired-side-handles",
            "front-latch-projection"
          ],
          "structuralFeatures": [
            "reinforced-case",
            "hinged-lid",
            "front-latch",
            "left-handle",
            "right-handle"
          ],
          "surfaceFeatures": [
            "beveled-case-edges",
            "recessed-latch-bed",
            "rubber-handle-grips"
          ],
          "materialIds": [
            "painted-steel",
            "rubber",
            "status-light"
          ],
          "socketIds": [
            "lid-hinge",
            "carry-attachment"
          ]
        },
        "materials": [
          {
            "id": "painted-steel",
            "baseColor": "#39434f",
            "metallic": 0.72,
            "roughness": 0.34
          },
          {
            "id": "rubber",
            "baseColor": "#171a1f",
            "metallic": 0.02,
            "roughness": 0.86
          },
          {
            "id": "status-light",
            "baseColor": "#f2a93b",
            "metallic": 0.18,
            "roughness": 0.28
          }
        ],
        "components": [
          {
            "id": "case",
            "primitive": "box",
            "dimensions": [
              3.6,
              1.8,
              2.4
            ],
            "materialId": "painted-steel"
          },
          {
            "id": "lid",
            "primitive": "box",
            "dimensions": [
              3.45,
              0.34,
              2.25
            ],
            "materialId": "painted-steel"
          },
          {
            "id": "latch",
            "primitive": "cylinder",
            "dimensions": [
              0.36,
              0.72,
              0.36
            ],
            "materialId": "status-light"
          },
          {
            "id": "left-handle",
            "primitive": "cylinder",
            "dimensions": [
              0.32,
              1.1,
              0.32
            ],
            "materialId": "rubber"
          },
          {
            "id": "right-handle",
            "primitive": "cylinder",
            "dimensions": [
              0.32,
              1.1,
              0.32
            ],
            "materialId": "rubber"
          }
        ],
        "hierarchy": [
          {
            "id": "crate-body-node",
            "parentId": null,
            "componentId": "case",
            "transform": {
              "translation": [
                0,
                1,
                0
              ],
              "rotationEulerDegrees": [
                0,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          },
          {
            "id": "crate-lid-node",
            "parentId": "crate-body-node",
            "componentId": "lid",
            "transform": {
              "translation": [
                0,
                1.05,
                0
              ],
              "rotationEulerDegrees": [
                0,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          },
          {
            "id": "crate-latch-node",
            "parentId": "crate-lid-node",
            "componentId": "latch",
            "transform": {
              "translation": [
                0,
                -0.1,
                1.18
              ],
              "rotationEulerDegrees": [
                90,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          },
          {
            "id": "crate-left-handle-node",
            "parentId": "crate-body-node",
            "componentId": "left-handle",
            "transform": {
              "translation": [
                -1.9,
                0.1,
                0
              ],
              "rotationEulerDegrees": [
                0,
                0,
                90
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          },
          {
            "id": "crate-right-handle-node",
            "parentId": "crate-body-node",
            "componentId": "right-handle",
            "transform": {
              "translation": [
                1.9,
                0.1,
                0
              ],
              "rotationEulerDegrees": [
                0,
                0,
                90
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          }
        ],
        "sockets": [
          {
            "id": "lid-hinge",
            "nodeId": "crate-lid-node",
            "kind": "animation",
            "axis": "x",
            "amplitude": 24,
            "frequencyHz": 0.35
          },
          {
            "id": "carry-attachment",
            "nodeId": "crate-body-node",
            "kind": "attachment",
            "axis": "y",
            "amplitude": 0,
            "frequencyHz": 0
          }
        ]
      }
    },
    "seed": 8001
  },
  {
    "intake": {
      "schemaVersion": 1,
      "kind": "sceneaxi.sculpt-intake",
      "intakeId": "field-drone",
      "mode": "structured-spec",
      "structuredSpec": {
        "schemaVersion": 1,
        "kind": "sceneaxi.object-sculpt-spec",
        "id": "field-drone",
        "rootNodeId": "drone-core-node",
        "complexityClass": "non-trivial",
        "passes": [
          {
            "id": "blockout",
            "deterministic": true,
            "steps": [
              "block-core-volume",
              "set-arm-span"
            ]
          },
          {
            "id": "structure",
            "deterministic": true,
            "steps": [
              "place-stabilizer-ring",
              "place-four-arms",
              "place-sensor-pod"
            ]
          },
          {
            "id": "materials",
            "deterministic": true,
            "steps": [
              "assign-composite-shell",
              "assign-arm-metal",
              "assign-optic-glass"
            ]
          },
          {
            "id": "surface-detail",
            "deterministic": true,
            "steps": [
              "bevel-arm-edges",
              "recess-sensor-aperture",
              "band-stabilizer-ring"
            ]
          },
          {
            "id": "sockets",
            "deterministic": true,
            "steps": [
              "bind-sensor-scan",
              "bind-payload-point"
            ]
          }
        ],
        "detailInventory": {
          "silhouetteFeatures": [
            "cross-arm-span",
            "central-stabilizer-ring",
            "underslung-sensor-pod"
          ],
          "structuralFeatures": [
            "core-shell",
            "stabilizer-ring",
            "north-arm",
            "east-arm",
            "south-arm",
            "west-arm",
            "sensor-pod"
          ],
          "surfaceFeatures": [
            "arm-edge-bevels",
            "sensor-aperture",
            "ring-band"
          ],
          "materialIds": [
            "composite-shell",
            "arm-metal",
            "optic-glass"
          ],
          "socketIds": [
            "sensor-scan",
            "payload-attachment"
          ]
        },
        "materials": [
          {
            "id": "composite-shell",
            "baseColor": "#53616f",
            "metallic": 0.22,
            "roughness": 0.46
          },
          {
            "id": "arm-metal",
            "baseColor": "#242b33",
            "metallic": 0.82,
            "roughness": 0.25
          },
          {
            "id": "optic-glass",
            "baseColor": "#38bde8",
            "metallic": 0.12,
            "roughness": 0.16
          }
        ],
        "components": [
          {
            "id": "core",
            "primitive": "sphere",
            "dimensions": [
              2.2,
              1.4,
              2.2
            ],
            "materialId": "composite-shell"
          },
          {
            "id": "ring",
            "primitive": "cylinder",
            "dimensions": [
              2.8,
              0.24,
              2.8
            ],
            "materialId": "arm-metal"
          },
          {
            "id": "north-arm",
            "primitive": "box",
            "dimensions": [
              0.34,
              0.22,
              2.1
            ],
            "materialId": "arm-metal"
          },
          {
            "id": "east-arm",
            "primitive": "box",
            "dimensions": [
              2.1,
              0.22,
              0.34
            ],
            "materialId": "arm-metal"
          },
          {
            "id": "south-arm",
            "primitive": "box",
            "dimensions": [
              0.34,
              0.22,
              2.1
            ],
            "materialId": "arm-metal"
          },
          {
            "id": "west-arm",
            "primitive": "box",
            "dimensions": [
              2.1,
              0.22,
              0.34
            ],
            "materialId": "arm-metal"
          },
          {
            "id": "sensor",
            "primitive": "sphere",
            "dimensions": [
              0.72,
              0.72,
              0.72
            ],
            "materialId": "optic-glass"
          }
        ],
        "hierarchy": [
          {
            "id": "drone-core-node",
            "parentId": null,
            "componentId": "core",
            "transform": {
              "translation": [
                0,
                2.2,
                0
              ],
              "rotationEulerDegrees": [
                0,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          },
          {
            "id": "drone-ring-node",
            "parentId": "drone-core-node",
            "componentId": "ring",
            "transform": {
              "translation": [
                0,
                0,
                0
              ],
              "rotationEulerDegrees": [
                0,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          },
          {
            "id": "drone-north-arm-node",
            "parentId": "drone-core-node",
            "componentId": "north-arm",
            "transform": {
              "translation": [
                0,
                0,
                -1.7
              ],
              "rotationEulerDegrees": [
                0,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          },
          {
            "id": "drone-east-arm-node",
            "parentId": "drone-core-node",
            "componentId": "east-arm",
            "transform": {
              "translation": [
                1.7,
                0,
                0
              ],
              "rotationEulerDegrees": [
                0,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          },
          {
            "id": "drone-south-arm-node",
            "parentId": "drone-core-node",
            "componentId": "south-arm",
            "transform": {
              "translation": [
                0,
                0,
                1.7
              ],
              "rotationEulerDegrees": [
                0,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          },
          {
            "id": "drone-west-arm-node",
            "parentId": "drone-core-node",
            "componentId": "west-arm",
            "transform": {
              "translation": [
                -1.7,
                0,
                0
              ],
              "rotationEulerDegrees": [
                0,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          },
          {
            "id": "drone-sensor-node",
            "parentId": "drone-core-node",
            "componentId": "sensor",
            "transform": {
              "translation": [
                0,
                -0.95,
                0.45
              ],
              "rotationEulerDegrees": [
                0,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ]
            }
          }
        ],
        "sockets": [
          {
            "id": "sensor-scan",
            "nodeId": "drone-sensor-node",
            "kind": "animation",
            "axis": "y",
            "amplitude": 0.18,
            "frequencyHz": 1.5
          },
          {
            "id": "payload-attachment",
            "nodeId": "drone-core-node",
            "kind": "attachment",
            "axis": "y",
            "amplitude": 0,
            "frequencyHz": 0
          }
        ]
      }
    },
    "seed": 8002
  }
];

export function workshopTemplate(documentId: string) {
  const artifacts = SOURCES.map(source => {
    const result = reconstructSculpt(source.intake, { seed: source.seed });

    if (!result.ok) throw new Error(`TEMPLATE_RECONSTRUCTION_REFUSED: ${result.code}`);

    return result.artifact;
  });

  return composeScene(INTAKE, artifacts, { documentId, title: "Workshop bay" });
}
