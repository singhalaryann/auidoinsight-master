actor NewUser {}

resource Organization {
  roles = ["org_owner", "billing_admin", "member"];
  permissions = ["project:create"];
  
  "project:create" if "org_owner";
}

resource Project {
  roles = ["project_admin", "analyst", "viewer"];
  permissions = ["analysis:view", "snapshot:view"];
  relations = {
    organization: Organization
  };
}