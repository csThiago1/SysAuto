-- Extensão pgvector (RAG / embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Schema isolado para o Keycloak (exigido pelo KC_DB_SCHEMA)
CREATE SCHEMA IF NOT EXISTS keycloak;
