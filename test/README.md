# Test Suite Documentation

Cette suite de tests complète couvre toutes les fonctionnalités étendues du module nuxt-auth-utils incluant :

## Structure des Tests

### Tests Unitaires

- **`unit/database.test.ts`** - Tests des utilitaires de base de données
- **`unit/rbac.test.ts`** - Tests complets du système RBAC
- **`unit/tenant.test.ts`** - Tests multi-tenant
- **`unit/totp.test.ts`** - Tests TOTP/2FA
- **`unit/super-admin.test.ts`** - Tests super-administrateur  
- **`unit/audit.test.ts`** - Tests d'audit
- **`unit/password.test.ts`** - Tests utilitaires de mot de passe

### Mocks

- **`mocks/database.mock.ts`** - Mock complet de Drizzle ORM
- **`mocks/totp.mock.ts`** - Mock de otpauth et qrcode
- **`mocks/test-utils.ts`** - Utilitaires de test réutilisables

## Fonctionnalités Testées

### Base de Données (Drizzle ORM)
- ✅ Connexions SQLite, PostgreSQL, MySQL
- ✅ Gestion des transactions
- ✅ Migrations automatiques
- ✅ Gestion d'erreurs
- ✅ États activé/désactivé

### RBAC (Contrôle d'Accès Basé sur les Rôles)
- ✅ Attribution et suppression de rôles
- ✅ Vérification des permissions
- ✅ Permissions hiérarchiques
- ✅ Super-admin bypass
- ✅ Sessions avec RBAC

### Multi-Tenant
- ✅ Détection par sous-domaine
- ✅ Détection par chemin
- ✅ Détection par en-tête
- ✅ Stratégies personnalisées
- ✅ Isolation des données
- ✅ Cache de contexte

### TOTP/2FA
- ✅ Génération de secrets TOTP
- ✅ Codes QR
- ✅ Vérification de codes
- ✅ Codes de récupération
- ✅ Activation/désactivation
- ✅ Gestion des erreurs

### Super-Administrateur
- ✅ Validation de configuration
- ✅ Création automatique
- ✅ Permissions cross-tenant
- ✅ Validation de mot de passe fort
- ✅ Variables d'environnement

### Audit
- ✅ Journalisation des événements
- ✅ Extraction d'IP
- ✅ Filtrage et pagination
- ✅ Helpers spécialisés
- ✅ Gestion d'erreurs

### Mots de Passe
- ✅ Hachage sécurisé (scrypt)
- ✅ Vérification
- ✅ Validation de force
- ✅ Génération sécurisée
- ✅ Vérification de compromission

## Exécution des Tests

```bash
# Tous les tests
npm test

# Tests avec couverture
npm run test:coverage

# Tests en mode watch
npm run test:watch

# Tests spécifiques
npx vitest run test/unit/database.test.ts
```

## Métriques de Couverture

Les tests couvrent :
- Cas normaux d'utilisation
- Gestion d'erreurs
- Cas limites (edge cases)
- États désactivés/fallbacks
- Opérations concurrentes
- Validation d'entrées

## Configuration

- **`vitest.config.ts`** - Configuration Vitest
- **`test/tsconfig.json`** - Configuration TypeScript pour tests
- **`test/setup.ts`** - Configuration globale

## Mocking Strategy

Utilise des mocks complets pour :
- Drizzle ORM avec simulation de requêtes
- TOTP/QR Code avec données de test
- Variables d'environnement
- Fonctions Nuxt/Vue
- Crypto et utilitaires système

## Bonnes Pratiques

1. **Isolation** - Chaque test est indépendant
2. **Reset** - Données mockées réinitialisées entre tests
3. **Coverage** - Couvre succès, erreurs et cas limites
4. **Realistic** - Mocks comportent comme vraies dépendances
5. **Parallel** - Tests peuvent s'exécuter en parallèle