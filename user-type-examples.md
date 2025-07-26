# User Type Examples

## Authentication Response with User Type

When a user signs in, the authentication response will now include a `userType` field:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "John Doe",
    "email": "john@example.com",
    "role": 2,
    "userType": 0
  }
}
```

## User Type Values

The `userType` field uses integer values:

- **0 = INDIVIDUAL_FREELANCER**: User is not associated with any company
- **1 = COMPANY_USER**: User belongs to a company but doesn't own it
- **2 = COMPANY_OWNER**: User owns a company

## User Type Determination Logic

1. **Company Owner (userType: 2)**
   - User has an `ownedCompany` relationship
   - They created and own a company

2. **Company User (userType: 1)**
   - User has a `companyId` or `company` relationship
   - They belong to a company but don't own it

3. **Individual Freelancer (userType: 0)**
   - User has no company associations
   - They work independently

## Example Scenarios

### Scenario 1: Individual Freelancer

```json
{
  "user": {
    "id": "user-1",
    "name": "Alice Smith",
    "email": "alice@freelancer.com",
    "role": 2,
    "userType": 0 // INDIVIDUAL_FREELANCER
  }
}
```

### Scenario 2: Company User

```json
{
  "user": {
    "id": "user-2",
    "name": "Bob Johnson",
    "email": "bob@company.com",
    "role": 2,
    "userType": 1 // COMPANY_USER
  }
}
```

### Scenario 3: Company Owner

```json
{
  "user": {
    "id": "user-3",
    "name": "Carol Wilson",
    "email": "carol@mycompany.com",
    "role": 2,
    "userType": 2 // COMPANY_OWNER
  }
}
```

## Frontend Usage

Frontend applications can use this information to:

- Show different UI elements based on user type
- Enable/disable features for company owners vs individual users
- Display appropriate workspace creation options
- Customize navigation and permissions

```typescript
// Example frontend usage
if (user.userType === USER_TYPES.COMPANY_OWNER) {
  // Show company management features
  showCompanyManagement();
} else if (user.userType === USER_TYPES.COMPANY_USER) {
  // Show limited company features
  showCompanyUserFeatures();
} else {
  // Show individual freelancer features
  showFreelancerFeatures();
}
```
