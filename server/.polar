actor User {}

resource Organization {
  roles = ["org_owner"];
  permissions = ["project:create", "assign_project_roles", "invite"];

  "project:create" if "org_owner";
  "assign_project_roles" if "org_owner";
  "invite" if "org_owner";
}

resource Project {
  roles = ["viewer", "editor", "analyst"];
  permissions = [
    "project:view",
    "project:edit",
    "project:analyze",
    "invite",
    "assign_project_roles"
  ];
  relations = { organization: Organization };

  "project:view" if "viewer";
  "project:edit" if "editor";
  "project:analyze" if "analyst";
  "invite" if "editor";
  "invite" if "analyst";

  "viewer" if "editor";
  "viewer" if "analyst";

  # Inherited permissions from Organization
  "project:view" if "org_owner" on "organization";
  "project:edit" if "org_owner" on "organization";
  "project:analyze" if "org_owner" on "organization";
  "invite" if "org_owner" on "organization";
  "assign_project_roles" if "org_owner" on "organization";
}

test "Organization roles and permissions" {
  setup {
    has_role(User{"alice"}, "org_owner", Organization{"example"});
  }
  assert     allow(User{"alice"}, "project:create", Organization{"example"});
  assert     allow(User{"alice"}, "assign_project_roles", Organization{"example"});
  assert     allow(User{"alice"}, "invite", Organization{"example"});
}

test "Project roles and permissions" {
  setup {
    has_role(User{"alice"}, "viewer", Project{"example"});
    has_role(User{"bob"}, "editor", Project{"example"});
    has_role(User{"charlie"}, "analyst", Project{"example"});
  }

  assert     allow(User{"alice"}, "project:view", Project{"example"});
  assert     allow(User{"bob"}, "project:view", Project{"example"});
  assert     allow(User{"charlie"}, "project:view", Project{"example"});

  assert_not allow(User{"alice"}, "project:edit", Project{"example"});
  assert     allow(User{"bob"}, "project:edit", Project{"example"});
  assert_not allow(User{"charlie"}, "project:edit", Project{"example"});

  assert_not allow(User{"alice"}, "project:analyze", Project{"example"});
  assert_not allow(User{"bob"}, "project:analyze", Project{"example"});
  assert     allow(User{"charlie"}, "project:analyze", Project{"example"});
}
