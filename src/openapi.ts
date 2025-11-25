// OpenAPI 3.0 description of the EscrowGrid TAAS API.
// This is intentionally hand-authored to stay in sync with the
// actual Express routes and domain types.

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'EscrowGrid API',
    version: '1.0.0',
    description:
      'Tokenization-as-a-Service (TAAS) infrastructure for escrowable real-world assets.\n\n' +
      'EscrowGrid exposes an API surface for institutions to manage institutions, API keys, asset templates, assets, positions, policies, and ledgers.\n\n' +
      'Authentication is performed via API keys. Most endpoints require `X-API-KEY` or `Authorization: Bearer <token>` headers. ' +
      'Only `/health`, `/ready`, `/openapi.json`, `/docs`, and `/docs/redoc` are publicly accessible.'
  },
  servers: [
    {
      url: 'https://api.escrowgrid.io',
      description: 'Production (example)'
    },
    {
      url: 'http://localhost:4000',
      description: 'Local development'
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-KEY'
      }
    },
    schemas: {
      Region: {
        type: 'string',
        enum: ['US', 'EU_UK', 'SG', 'UAE']
      },
      Vertical: {
        type: 'string',
        enum: ['CONSTRUCTION', 'TRADE_FINANCE']
      },
      Institution: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          regions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Region' }
          },
          verticals: {
            type: 'array',
            items: { $ref: '#/components/schemas/Vertical' }
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'name', 'regions', 'createdAt', 'updatedAt']
      },
      ApiKeyRole: {
        type: 'string',
        enum: ['admin', 'read_only']
      },
      ApiKeyPublic: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          institutionId: { type: 'string' },
          label: { type: 'string' },
          role: { $ref: '#/components/schemas/ApiKeyRole' },
          createdAt: { type: 'string', format: 'date-time' },
          revokedAt: { type: 'string', format: 'date-time', nullable: true }
        },
        required: ['id', 'institutionId', 'label', 'role', 'createdAt']
      },
      ApiKeyCreated: {
        allOf: [
          { $ref: '#/components/schemas/ApiKeyPublic' },
          {
            type: 'object',
            properties: {
              apiKey: {
                type: 'string',
                description: 'Plaintext API key. Returned only once on creation.'
              }
            },
            required: ['apiKey']
          }
        ]
      },
      AssetTemplate: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          institutionId: { type: 'string' },
          code: { type: 'string' },
          name: { type: 'string' },
          vertical: { $ref: '#/components/schemas/Vertical' },
          region: { $ref: '#/components/schemas/Region' },
          config: {
            type: 'object',
            description:
              'Template configuration. Shape depends on `code` and `vertical`. See domain documentation for constraints.'
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        },
        required: [
          'id',
          'institutionId',
          'code',
          'name',
          'vertical',
          'region',
          'config',
          'createdAt',
          'updatedAt'
        ]
      },
      Asset: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          institutionId: { type: 'string' },
          templateId: { type: 'string' },
          label: { type: 'string' },
          metadata: {
            type: 'object',
            description: 'Arbitrary JSON metadata associated with the asset.'
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'institutionId', 'templateId', 'label', 'metadata', 'createdAt', 'updatedAt']
      },
      PositionState: {
        type: 'string',
        enum: ['CREATED', 'FUNDED', 'PARTIALLY_RELEASED', 'RELEASED', 'CANCELLED', 'EXPIRED']
      },
      PositionLifecycleEvent: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          positionId: { type: 'string' },
          fromState: {
            $ref: '#/components/schemas/PositionState',
            nullable: true
          },
          toState: { $ref: '#/components/schemas/PositionState' },
          reason: { type: 'string', nullable: true },
          at: { type: 'string', format: 'date-time' },
          metadata: {
            type: 'object',
            nullable: true,
            description: 'Optional JSON metadata about the transition.'
          }
        },
        required: ['id', 'positionId', 'toState', 'at']
      },
      Position: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          institutionId: { type: 'string' },
          assetId: { type: 'string' },
          holderReference: { type: 'string' },
          currency: { type: 'string' },
          amount: { type: 'number' },
          state: { $ref: '#/components/schemas/PositionState' },
          externalReference: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          events: {
            type: 'array',
            items: { $ref: '#/components/schemas/PositionLifecycleEvent' }
          }
        },
        required: [
          'id',
          'institutionId',
          'assetId',
          'holderReference',
          'currency',
          'amount',
          'state',
          'createdAt',
          'updatedAt',
          'events'
        ]
      },
      PolicyConfig: {
        type: 'object',
        properties: {
          region: { $ref: '#/components/schemas/Region' },
          position: {
            type: 'object',
            properties: {
              minAmount: { type: 'number', nullable: true },
              maxAmount: { type: 'number', nullable: true },
              allowedCurrencies: {
                type: 'array',
                items: { type: 'string' },
                nullable: true
              }
            }
          }
        },
        required: ['region', 'position']
      },
      InstitutionPolicy: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          institutionId: { type: 'string' },
          region: { $ref: '#/components/schemas/Region' },
          config: { $ref: '#/components/schemas/PolicyConfig' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'institutionId', 'region', 'config', 'createdAt', 'updatedAt']
      },
      LedgerEvent: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: ['POSITION_CREATED', 'POSITION_STATE_CHANGED'] },
          positionId: { type: 'string' },
          at: { type: 'string', format: 'date-time' },
          previousState: { $ref: '#/components/schemas/PositionState', nullable: true },
          newState: { $ref: '#/components/schemas/PositionState', nullable: true },
          payload: {
            type: 'object',
            description: 'JSON payload that captures the business context of the event.'
          }
        },
        required: ['id', 'kind', 'positionId', 'at', 'payload']
      },
      MetricsSnapshot: {
        type: 'object',
        properties: {
          totalRequests: { type: 'integer' },
          totalErrors: { type: 'integer' },
          requestsByStatus: {
            type: 'object',
            additionalProperties: { type: 'integer' }
          },
          requestsByMethod: {
            type: 'object',
            additionalProperties: { type: 'integer' }
          },
          averageDurationMs: { type: 'number' }
        },
        required: ['totalRequests', 'totalErrors', 'requestsByStatus', 'requestsByMethod']
      },
      ApiErrorPayload: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: {}
        },
        required: ['error']
      }
    }
  },
  security: [
    {
      ApiKeyAuth: []
    }
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Liveness probe',
        description: 'Lightweight health check that does not hit the database.',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'taas-platform' },
                    storeBackend: { type: 'string', example: 'postgres' }
                  }
                }
              }
            }
          }
        },
        security: []
      }
    },
    '/ready': {
      get: {
        summary: 'Readiness probe',
        description: 'Checks readiness, including Postgres connectivity when configured.',
        responses: {
          '200': {
            description: 'Service is ready',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    storeBackend: { type: 'string' },
                    db: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          },
          '503': {
            description: 'One or more dependencies are unavailable'
          }
        },
        security: []
      }
    },
    '/metrics': {
      get: {
        summary: 'In-memory request metrics (root-only)',
        responses: {
          '200': {
            description: 'Current metrics snapshot',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MetricsSnapshot' }
              }
            }
          },
          '401': { description: 'Missing or invalid API key' },
          '403': { description: 'API key is not root' }
        }
      }
    },
    '/institutions': {
      get: {
        summary: 'List institutions',
        description:
          'Root: returns all institutions. Institution keys: returns only the calling institution.',
        responses: {
          '200': {
            description: 'List of institutions',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Institution' }
                }
              }
            }
          },
          '401': { description: 'Unauthenticated' }
        }
      },
      post: {
        summary: 'Create institution (root only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  regions: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Region' }
                  },
                  verticals: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Vertical' }
                  }
                },
                required: ['name', 'regions']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Institution created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Institution' }
              }
            }
          },
          '400': {
            description: 'Invalid request body',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorPayload' }
              }
            }
          },
          '403': { description: 'Only root can create institutions' }
        }
      }
    },
    '/institutions/{id}': {
      get: {
        summary: 'Get institution by id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Institution',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Institution' }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to access this institution' },
          '404': { description: 'Institution not found' }
        }
      }
    },
    '/institutions/{id}/api-keys': {
      post: {
        summary: 'Create API key for institution',
        description: 'Root or institution admin can create new API keys.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  label: { type: 'string', default: 'default' },
                  role: { $ref: '#/components/schemas/ApiKeyRole' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'API key created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiKeyCreated' }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to create API keys for this institution' },
          '404': { description: 'Institution not found' }
        }
      },
      get: {
        summary: 'List API keys for institution',
        description: 'Root or institution admin can list keys. Secrets are not returned.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'List of API keys',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ApiKeyPublic' }
                }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to list keys for this institution' },
          '404': { description: 'Institution not found' }
        }
      }
    },
    '/asset-templates': {
      post: {
        summary: 'Create asset template',
        description:
          'Root or institution admin can create templates. For non-root, the institution is derived from the API key.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  institutionId: {
                    type: 'string',
                    description: 'Required when using root keys; ignored for institution keys.'
                  },
                  code: { type: 'string' },
                  name: { type: 'string' },
                  vertical: { $ref: '#/components/schemas/Vertical' },
                  region: { $ref: '#/components/schemas/Region' },
                  config: {
                    type: 'object',
                    description:
                      'Template configuration. Validated according to vertical- and code-specific rules.'
                  }
                },
                required: ['code', 'name', 'vertical', 'region']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Template created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AssetTemplate' }
              }
            }
          },
          '400': {
            description: 'Invalid request body or validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorPayload' }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to create templates for this institution' }
        }
      },
      get: {
        summary: 'List asset templates',
        parameters: [
          {
            name: 'institutionId',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'List of asset templates',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AssetTemplate' }
                }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'No institution associated with API key' }
        }
      }
    },
    '/asset-templates/{id}': {
      get: {
        summary: 'Get asset template by id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Asset template',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AssetTemplate' }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to access this asset template' },
          '404': { description: 'Asset template not found' }
        }
      }
    },
    '/assets': {
      post: {
        summary: 'Create asset',
        description:
          'Root or institution admin can create assets. For non-root, the institution is derived from the API key.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  institutionId: {
                    type: 'string',
                    description: 'Required when using root keys; ignored for institution keys.'
                  },
                  templateId: { type: 'string' },
                  label: { type: 'string' },
                  metadata: {
                    type: 'object',
                    description: 'Arbitrary JSON metadata for the asset.'
                  }
                },
                required: ['templateId', 'label']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Asset created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Asset' }
              }
            }
          },
          '400': {
            description: 'Invalid request body or validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorPayload' }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to create assets for this institution' }
        }
      },
      get: {
        summary: 'List assets',
        parameters: [
          {
            name: 'institutionId',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          },
          {
            name: 'templateId',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'List of assets',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Asset' }
                }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'No institution associated with API key' }
        }
      }
    },
    '/assets/{id}': {
      get: {
        summary: 'Get asset by id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Asset',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Asset' }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to access this asset' },
          '404': { description: 'Asset not found' }
        }
      }
    },
    '/positions': {
      post: {
        summary: 'Create position',
        description:
          'Create an escrow position under an asset. Enforces institution- and region-specific policies before creation.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  institutionId: {
                    type: 'string',
                    description: 'Required when using root keys; ignored for institution keys.'
                  },
                  assetId: { type: 'string' },
                  holderReference: { type: 'string' },
                  currency: { type: 'string' },
                  amount: { type: 'number' },
                  externalReference: { type: 'string' }
                },
                required: ['assetId', 'holderReference', 'currency', 'amount']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Position created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Position' }
              }
            }
          },
          '400': {
            description: 'Invalid body, policy violation, or asset/template mismatch',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorPayload' }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to create positions for this institution' }
        }
      },
      get: {
        summary: 'List positions',
        parameters: [
          {
            name: 'institutionId',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          },
          {
            name: 'assetId',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          },
          {
            name: 'holderReference',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'List of positions',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Position' }
                }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'No institution associated with API key' }
        }
      }
    },
    '/positions/{id}': {
      get: {
        summary: 'Get position by id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Position',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Position' }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to access this position' },
          '404': { description: 'Position not found' }
        }
      }
    },
    '/positions/{id}/transition': {
      post: {
        summary: 'Transition a position',
        description:
          'Applies a lifecycle transition to a position. Validity of transitions is enforced by the lifecycle engine.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  toState: { $ref: '#/components/schemas/PositionState' },
                  reason: { type: 'string' },
                  metadata: {
                    type: 'object',
                    description: 'Optional JSON metadata about the transition.'
                  }
                },
                required: ['toState']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Position transitioned',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Position' }
              }
            }
          },
          '400': {
            description: 'Invalid body or invalid transition',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorPayload' }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to transition this position' },
          '404': { description: 'Position not found' }
        }
      }
    },
    '/ledger-events': {
      get: {
        summary: 'Query ledger events',
        parameters: [
          {
            name: 'positionId',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Matching ledger events',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/LedgerEvent' }
                }
              }
            }
          },
          '400': {
            description: 'Missing positionId for non-root key'
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to access ledger events for this position' },
          '404': { description: 'Position not found' }
        }
      }
    },
    '/institutions/{id}/policies': {
      get: {
        summary: 'List policies for institution',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'List of institution policies',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/InstitutionPolicy' }
                }
              }
            }
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to access policies for this institution' },
          '404': { description: 'Institution not found' }
        }
      }
    },
    '/institutions/{id}/policies/{region}': {
      get: {
        summary: 'Get policy for an institution/region',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'region',
            in: 'path',
            required: true,
            schema: { $ref: '#/components/schemas/Region' }
          }
        ],
        responses: {
          '200': {
            description: 'Policy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InstitutionPolicy' }
              }
            }
          },
          '400': { description: 'Invalid region' },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to access policies for this institution' },
          '404': { description: 'Institution or policy not found' }
        }
      },
      put: {
        summary: 'Upsert policy for an institution/region',
        description: 'Root or institution admin can configure policies for a given region.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'region',
            in: 'path',
            required: true,
            schema: { $ref: '#/components/schemas/Region' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  position: {
                    type: 'object',
                    properties: {
                      minAmount: { type: 'number' },
                      maxAmount: { type: 'number' },
                      allowedCurrencies: {
                        type: 'array',
                        items: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Policy upserted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InstitutionPolicy' }
              }
            }
          },
          '400': { description: 'Invalid region or body' },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Forbidden to modify policies for this institution' },
          '404': { description: 'Institution not found' }
        }
      }
    }
  }
} as const;

