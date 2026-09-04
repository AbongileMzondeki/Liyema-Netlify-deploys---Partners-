const { writeJSON, readJSON } = require('./_shared/blobStore');
const { requireAdmin } = require('./_shared/auth');

/* One-time / emergency bootstrap: restores the last known-good real Squarelink
   snapshot (pulled 23 Jul 2026, 42 roles) captured directly from the live Blobs
   store. Admin-triggered only, and requires an explicit {"confirm": true} body
   so it can never be invoked accidentally by a bare/empty POST (a prior version
   of this function had no such guard and was tripped by an automated contract
   probe during a rebuild, silently overwriting the live roles data with an old
   8-role placeholder snapshot — this version fixes that). Does not touch
   submissions/feedback except to initialise them if they don't exist yet. */
const SNAPSHOT_ROLES = [
  {
    "id": "j1",
    "title": "HSE Officer - Durban",
    "client": "Cummins",
    "status": "Open",
    "dateOpened": "2026-07-23",
    "deadline": null,
    "apps": 3,
    "cvsToClient": 2,
    "submittedBy": null,
    "stages": {
      "Submitted": 2
    }
  },
  {
    "id": "j2",
    "title": "SAP DRC / e-Invoicing Finance Specialist",
    "client": "Accenture",
    "status": "Open",
    "dateOpened": "2026-07-23",
    "deadline": null,
    "apps": 1,
    "cvsToClient": 1,
    "submittedBy": null,
    "stages": {
      "Submitted": 1
    }
  },
  {
    "id": "j3",
    "title": "SAP HCM Specialist",
    "client": "Accenture",
    "status": "Open",
    "dateOpened": "2026-07-23",
    "deadline": null,
    "apps": 2,
    "cvsToClient": 2,
    "submittedBy": null,
    "stages": {
      "Submitted": 2
    }
  },
  {
    "id": "j4",
    "title": "Senior SAP MDM Consultant",
    "client": "Accenture",
    "status": "Open",
    "dateOpened": "2026-07-23",
    "deadline": null,
    "apps": 1,
    "cvsToClient": 1,
    "submittedBy": null,
    "stages": {
      "Submitted": 1
    }
  },
  {
    "id": "j5",
    "title": "SOC/Cybersecurity Specialist",
    "client": "Accenture",
    "status": "Open",
    "dateOpened": "2026-07-23",
    "deadline": null,
    "apps": 1,
    "cvsToClient": 1,
    "submittedBy": null,
    "stages": {
      "Submitted": 1
    }
  },
  {
    "id": "j6",
    "title": "SAP FICO / S/4HANA Consultant (Group Reporting, Central Finance, BPC)",
    "client": "Accenture",
    "status": "Open",
    "dateOpened": "2026-07-23",
    "deadline": null,
    "apps": 1,
    "cvsToClient": 1,
    "submittedBy": null,
    "stages": {
      "Submitted": 1
    }
  },
  {
    "id": "j7",
    "title": "SAP Program/Project Manager (Cutover, Integration & Hypercare)",
    "client": "Accenture",
    "status": "Open",
    "dateOpened": "2026-07-23",
    "deadline": null,
    "apps": 1,
    "cvsToClient": 1,
    "submittedBy": null,
    "stages": {
      "Submitted": 1
    }
  },
  {
    "id": "j8",
    "title": "FAAS Manager",
    "client": "EY",
    "status": "Open",
    "dateOpened": "2026-07-09",
    "deadline": null,
    "apps": 12,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {}
  },
  {
    "id": "j9",
    "title": "Manager: Enterprise Risk (Internal Audit)",
    "client": "EY",
    "status": "Open",
    "dateOpened": "2026-07-08",
    "deadline": "2026-07-31",
    "apps": 0,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {}
  },
  {
    "id": "j10",
    "title": "Senior Manager - Financial Accounting and Advisory Services (FAAS)",
    "client": "EY",
    "status": "Open",
    "dateOpened": "2026-07-08",
    "deadline": "2026-07-30",
    "apps": 12,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {
      "Rejected": 1,
      "Withdrawn": 1
    }
  },
  {
    "id": "j11",
    "title": "On Site Service Technician - Level II",
    "client": "Cummins",
    "status": "Open",
    "dateOpened": "2026-06-26",
    "deadline": null,
    "apps": 6,
    "cvsToClient": 4,
    "submittedBy": null,
    "stages": {
      "Submitted": 2,
      "Rejected": 2
    }
  },
  {
    "id": "j12",
    "title": "Payroll Administrator \u2013 Level III - Contract Extension",
    "client": "Cummins",
    "status": "Open",
    "dateOpened": "2026-06-17",
    "deadline": null,
    "apps": 3,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {
      "Offer": 1
    }
  },
  {
    "id": "j13",
    "title": "Cloud Security Engineer",
    "client": "EY",
    "status": "Open",
    "dateOpened": "2026-06-12",
    "deadline": null,
    "apps": 3,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {
      "Submitted": 1,
      "1st Interview": 1
    }
  },
  {
    "id": "j14",
    "title": "NOC Agent - Voice",
    "client": "BitCo Telecom",
    "status": "Open",
    "dateOpened": "2026-06-08",
    "deadline": "2026-07-31",
    "apps": 4,
    "cvsToClient": 2,
    "submittedBy": null,
    "stages": {
      "Submitted": 1,
      "Employed": 1
    }
  },
  {
    "id": "j15",
    "title": "Diesel Mechanic",
    "client": "Cummins",
    "status": "Closed",
    "dateOpened": "2026-06-24",
    "deadline": "2026-06-30",
    "apps": 6,
    "cvsToClient": 1,
    "submittedBy": null,
    "stages": {
      "Submitted": 1
    }
  },
  {
    "id": "j16",
    "title": "Administrator B Upper \u2013 12-Month Contract",
    "client": "SNG",
    "status": "Closed",
    "dateOpened": "2026-06-19",
    "deadline": "2026-07-18",
    "apps": 0,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {}
  },
  {
    "id": "j17",
    "title": "Senior Manager: PM Support (D Upper) \u2013 12-Month Contract",
    "client": "SNG",
    "status": "Closed",
    "dateOpened": "2026-06-19",
    "deadline": "2026-07-18",
    "apps": 16,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {}
  },
  {
    "id": "j18",
    "title": "Senior Manager: PM Support",
    "client": "SNG",
    "status": "Closed",
    "dateOpened": "2026-06-19",
    "deadline": "2026-06-30",
    "apps": 0,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {}
  },
  {
    "id": "j19",
    "title": "Warehouse Operator \u2013 Level I - Contract Extension",
    "client": "Cummins",
    "status": "Closed",
    "dateOpened": "2026-06-09",
    "deadline": "2026-06-30",
    "apps": 2,
    "cvsToClient": 2,
    "submittedBy": null,
    "stages": {
      "Submitted": 2
    }
  },
  {
    "id": "j20",
    "title": "Mobile App UX/UI Product Designer \u2013 Level 7-8",
    "client": "Accenture",
    "status": "Closed",
    "dateOpened": "2025-11-21",
    "deadline": "2025-11-27",
    "apps": 3,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {
      "Rejected": 2
    }
  },
  {
    "id": "j21",
    "title": "Cobol Developer \u2013 Advanced Application Engineer",
    "client": "Accenture",
    "status": "Closed",
    "dateOpened": "2025-11-24",
    "deadline": "2025-11-26",
    "apps": 1,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {
      "Rejected": 1
    }
  },
  {
    "id": "j22",
    "title": "Employee Benefits & Compensation Senior Manager",
    "client": "EY",
    "status": "Closed",
    "dateOpened": "2026-06-05",
    "deadline": "2026-06-30",
    "apps": 9,
    "cvsToClient": 8,
    "submittedBy": null,
    "stages": {
      "Submitted": 5,
      "Rejected": 3
    }
  },
  {
    "id": "j23",
    "title": "NOC Agent",
    "client": "BitCo Telecom",
    "status": "Closed",
    "dateOpened": "2026-06-03",
    "deadline": "2026-06-30",
    "apps": 12,
    "cvsToClient": 5,
    "submittedBy": null,
    "stages": {
      "Submitted": 4,
      "Offer": 1,
      "Employed": 1
    }
  },
  {
    "id": "j24",
    "title": "Chief Operating Officer",
    "client": "SAMRO",
    "status": "Closed",
    "dateOpened": "2026-06-01",
    "deadline": "2026-06-30",
    "apps": 0,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {}
  },
  {
    "id": "j25",
    "title": "Business Development Manager \u2014 Data Centres",
    "client": "Cummins",
    "status": "Closed",
    "dateOpened": "2026-05-31",
    "deadline": "2026-06-30",
    "apps": 2,
    "cvsToClient": 2,
    "submittedBy": null,
    "stages": {
      "Rejected": 2
    }
  },
  {
    "id": "j26",
    "title": "Senior Enterprise Architect",
    "client": "Accenture",
    "status": "Closed",
    "dateOpened": "2026-05-28",
    "deadline": "2026-06-30",
    "apps": 5,
    "cvsToClient": 1,
    "submittedBy": null,
    "stages": {
      "Submitted": 1
    }
  },
  {
    "id": "j27",
    "title": "Scrum Master / Project Manager",
    "client": "Accenture",
    "status": "Closed",
    "dateOpened": "2026-05-26",
    "deadline": "2026-06-30",
    "apps": 10,
    "cvsToClient": 6,
    "submittedBy": null,
    "stages": {
      "Submitted": 6
    }
  },
  {
    "id": "j28",
    "title": "Business Analyst",
    "client": "Accenture",
    "status": "Closed",
    "dateOpened": "2026-05-26",
    "deadline": "2026-06-30",
    "apps": 15,
    "cvsToClient": 4,
    "submittedBy": null,
    "stages": {
      "Submitted": 4
    }
  },
  {
    "id": "j29",
    "title": "Engineering Lead",
    "client": "Accenture",
    "status": "Closed",
    "dateOpened": "2026-05-26",
    "deadline": "2026-06-30",
    "apps": 3,
    "cvsToClient": 3,
    "submittedBy": null,
    "stages": {
      "Submitted": 3
    }
  },
  {
    "id": "j30",
    "title": "Warehouse Operator \u2013 Level I",
    "client": "Cummins",
    "status": "Closed",
    "dateOpened": "2026-05-26",
    "deadline": "2026-06-30",
    "apps": 1,
    "cvsToClient": 1,
    "submittedBy": null,
    "stages": {
      "Employed": 1
    }
  },
  {
    "id": "j31",
    "title": "Release Manager",
    "client": "EY",
    "status": "Closed",
    "dateOpened": "2026-05-26",
    "deadline": "2026-06-30",
    "apps": 2,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {}
  },
  {
    "id": "j32",
    "title": "OT Cybersecurity Consultant",
    "client": "EY",
    "status": "Closed",
    "dateOpened": "2026-05-26",
    "deadline": "2026-06-30",
    "apps": 0,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {}
  },
  {
    "id": "j33",
    "title": "Branch Manager",
    "client": "Skynet Worldwide Express",
    "status": "Closed",
    "dateOpened": "2026-05-21",
    "deadline": "2026-06-30",
    "apps": 0,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {}
  },
  {
    "id": "j34",
    "title": "Health & Safety Assistant",
    "client": "Cummins",
    "status": "Closed",
    "dateOpened": "2026-05-11",
    "deadline": "2026-06-01",
    "apps": 0,
    "cvsToClient": null,
    "submittedBy": null,
    "stages": {}
  },
  {
    "id": "j35",
    "title": "Senior Accounts Receivables Associate \u2013 Level III",
    "client": "Cummins",
    "status": "Closed",
    "dateOpened": "2026-04-30",
    "deadline": "2026-05-08",
    "apps": 1,
    "cvsToClient": 1,
    "submittedBy": null,
    "stages": {
      "Employed": 1
    }
  },
  {
    "id": "j36",
    "title": "Senior Voice Engineer",
    "client": "BitCo Telecom",
    "status": "Closed",
    "dateOpened": "2026-05-08",
    "deadline": "2026-05-20",
    "apps": 4,
    "cvsToClient": 4,
    "submittedBy": null,
    "stages": {
      "Rejected": 4
    }
  },
  {
    "id": "j37",
    "title": "Service Desk Coordinator",
    "client": "Skynet Worldwide Express",
    "status": "Closed",
    "dateOpened": "2026-04-28",
    "deadline": "2026-05-31",
    "apps": 4,
    "cvsToClient": 4,
    "submittedBy": null,
    "stages": {
      "Submitted": 1,
      "Shortlisted": 1,
      "1st Interview": 1,
      "Withdrawn": 1
    }
  },
  {
    "id": "j38",
    "title": "Deal Management - Manager - Transaction Strategy and Execution",
    "client": "EY",
    "status": "Closed",
    "dateOpened": "2026-04-24",
    "deadline": "2026-06-30",
    "apps": 8,
    "cvsToClient": 5,
    "submittedBy": null,
    "stages": {
      "Submitted": 4,
      "Shortlisted": 1,
      "1st Interview": 1
    }
  },
  {
    "id": "j39",
    "title": "Senior Manager | Deal Management - Transaction Strategy and Execution",
    "client": "EY",
    "status": "Closed",
    "dateOpened": "2026-04-24",
    "deadline": "2026-06-30",
    "apps": 6,
    "cvsToClient": 1,
    "submittedBy": null,
    "stages": {
      "Shortlisted": 1
    }
  },
  {
    "id": "j40",
    "title": "Associate Director: Deal Management - Transaction Strategy and Execution",
    "client": "EY",
    "status": "Closed",
    "dateOpened": "2026-04-24",
    "deadline": "2026-06-30",
    "apps": 8,
    "cvsToClient": 2,
    "submittedBy": null,
    "stages": {
      "1st Interview": 1,
      "Rejected": 1
    }
  },
  {
    "id": "j41",
    "title": "Project Administrator",
    "client": "BitCo Telecom",
    "status": "Closed",
    "dateOpened": "2026-04-21",
    "deadline": "2026-05-08",
    "apps": 2,
    "cvsToClient": 2,
    "submittedBy": null,
    "stages": {
      "Rejected": 2
    }
  },
  {
    "id": "j42",
    "title": "Intermediate Java Full Stack Developer - Demo Data",
    "client": "Accenture",
    "status": "Closed",
    "dateOpened": "2026-04-16",
    "deadline": "2026-04-21",
    "apps": 4,
    "cvsToClient": 2,
    "submittedBy": null,
    "stages": {
      "Rejected": 4
    }
  }
];

exports.handler = async (event, context) => {
  try {
    requireAdmin(context);
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const body = JSON.parse(event.body || '{}');
    if (body.confirm !== true) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Refusing to seed without explicit confirmation. POST { "confirm": true } to proceed.' }),
      };
    }
    const rolesToLoad = Array.isArray(body.roles) ? body.roles : SNAPSHOT_ROLES;
    await writeJSON('roles', rolesToLoad);
    await writeJSON('meta', { dataPulledAt: body.dataPulledAt || '2026-07-23T17:06:12.691Z' });
    const existingSubs = await readJSON('submissions', null);
    if (existingSubs === null) await writeJSON('submissions', []);
    const existingFb = await readJSON('feedback', null);
    if (existingFb === null) await writeJSON('feedback', []);
    return { statusCode: 200, body: JSON.stringify({ ok: true, rolesLoaded: rolesToLoad.length }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
