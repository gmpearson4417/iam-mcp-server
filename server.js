const express = require('express');
const app = express();

app.use(express.json());

// Your IAM API configuration
const IAM_BASE_URL = process.env.IAM_BASE_URL || 'https://your-iam-system.com/api';
const IAM_TOKEN = process.env.IAM_TOKEN || 'your-token-here';

// MCP Tools Definition
const tools = [
  {
    name: "list_users",
    description: "List all users in the IAM system. Can optionally filter by role.",
    inputSchema: {
      type: "object",
      properties: {
        role: { 
          type: "string", 
          description: "Filter users by role (optional). Example: 'admin', 'user', 'developer'" 
        },
        limit: {
          type: "number",
          description: "Maximum number of users to return (optional)"
        }
      }
    }
  },
  {
    name: "get_user",
    description: "Get detailed information about a specific user by their ID",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { 
          type: "string", 
          description: "The unique identifier of the user" 
        }
      },
      required: ["user_id"]
    }
  },
  {
    name: "create_user",
    description: "Create a new user in the IAM system",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Username for the new user" },
        email: { type: "string", description: "Email address" },
        role: { type: "string", description: "User role (e.g., 'user', 'admin')" },
        first_name: { type: "string", description: "First name" },
        last_name: { type: "string", description: "Last name" }
      },
      required: ["username", "email"]
    }
  },
  {
    name: "update_user",
    description: "Update an existing user's information",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "User ID to update" },
        updates: { 
          type: "object", 
          description: "Object containing fields to update (e.g., {email: 'new@email.com', role: 'admin'})" 
        }
      },
      required: ["user_id", "updates"]
    }
  },
  {
    name: "delete_user",
    description: "Delete a user from the IAM system",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "User ID to delete" }
      },
      required: ["user_id"]
    }
  },
  {
    name: "list_roles",
    description: "List all available roles in the IAM system",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "assign_role",
    description: "Assign a role to a user",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "User ID" },
        role: { type: "string", description: "Role to assign" }
      },
      required: ["user_id", "role"]
    }
  },
  {
    name: "list_permissions",
    description: "List permissions for a specific user or role",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "User ID (optional)" },
        role: { type: "string", description: "Role name (optional)" }
      }
    }
  }
];

// Helper function to call IAM API
async function callIAM(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${IAM_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${IAM_BASE_URL}${endpoint}`, options);
  
  if (!response.ok) {
    throw new Error(`IAM API error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

// MCP Endpoints
app.post('/mcp/tools/list', (req, res) => {
  res.json({ tools });
});

app.post('/mcp/tools/call', async (req, res) => {
  const { name, arguments: args } = req.body;
  
  try {
    let result;
    
    switch(name) {
      case 'list_users':
        const params = new URLSearchParams();
        if (args.role) params.append('role', args.role);
        if (args.limit) params.append('limit', args.limit);
        const query = params.toString() ? `?${params.toString()}` : '';
        result = await callIAM(`/users${query}`);
        break;
        
      case 'get_user':
        result = await callIAM(`/users/${args.user_id}`);
        break;
        
      case 'create_user':
        result = await callIAM('/users', 'POST', args);
        break;
        
      case 'update_user':
        result = await callIAM(`/users/${args.user_id}`, 'PUT', args.updates);
        break;
        
      case 'delete_user':
        result = await callIAM(`/users/${args.user_id}`, 'DELETE');
        break;
        
      case 'list_roles':
        result = await callIAM('/roles');
        break;
        
      case 'assign_role':
        result = await callIAM(`/users/${args.user_id}/roles`, 'POST', { role: args.role });
        break;
        
      case 'list_permissions':
        if (args.user_id) {
          result = await callIAM(`/users/${args.user_id}/permissions`);
        } else if (args.role) {
          result = await callIAM(`/roles/${args.role}/permissions`);
        } else {
          result = await callIAM('/permissions');
        }
        break;
        
      default:
        return res.status(400).json({ error: `Unknown tool: ${name}` });
    }
    
    res.json({
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    });
    
  } catch (error) {
    res.status(500).json({
      content: [{
        type: "text",
        text: `Error: ${error.message}`
      }],
      isError: true
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'IAM MCP Server is running',
    tools: tools.length
  });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('IAM MCP Server is running on port ' + listener.address().port);
});
