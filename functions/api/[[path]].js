const KV_KEY = "all_weight_data";

// Helper function for JSON response
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: { 'Content-Type': 'application/json' },
    });
}

// Helper function for error response
function errorResponse(message, status = 500) {
    return jsonResponse({ message: message }, status);
}

async function handleGet(request, env) {
    try {
        const storedData = await env.WEIGHT_LOG_KV.get(KV_KEY);
        const data = storedData ? JSON.parse(storedData) : [];
        // Ensure data is sorted by date before sending
        data.sort((a, b) => new Date(a.date) - new Date(b.date));
        return jsonResponse(data);
    } catch (e) {
        console.error("KV GET Error:", e);
        return errorResponse("Failed to retrieve data from KV", 500);
    }
}

async function handlePost(request, env) {
    try {
        const newEntry = await request.json();

        // Basic validation on server-side too
        if (!newEntry || typeof newEntry !== 'object') {
            return errorResponse("Invalid request body", 400);
        }
        if (!newEntry.date || !newEntry.weight) {
            return errorResponse("Missing required fields: date and weight", 400);
        }
        const weightNum = parseFloat(newEntry.weight);
        if (isNaN(weightNum) || weightNum <= 0) {
             return errorResponse("Invalid weight value", 400);
        }

        // Ensure weight has one decimal place
        newEntry.weight = weightNum.toFixed(1);

        // Fetch existing data
        const storedData = await env.WEIGHT_LOG_KV.get(KV_KEY);
        let data = storedData ? JSON.parse(storedData) : [];

        // Add or update entry (simple approach: replace if date exists, otherwise add)
        const existingIndex = data.findIndex(entry => entry.date === newEntry.date);
        if (existingIndex > -1) {
            data[existingIndex] = newEntry; // Update existing entry for this date
        } else {
            data.push(newEntry); // Add new entry
        }

        // Sort data by date before saving
        data.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Store updated data back into KV
        await env.WEIGHT_LOG_KV.put(KV_KEY, JSON.stringify(data));

        return jsonResponse({ message: "Data saved successfully", entry: newEntry }, 201);

    } catch (e) {
        if (e instanceof SyntaxError) { // JSON parsing error
             return errorResponse("Invalid JSON format in request body", 400);
        }
        console.error("KV PUT Error:", e);
        return errorResponse("Failed to save data to KV", 500);
    }
}

export async function onRequest(context) {
    const { request, env, params, next } = context;
    const url = new URL(request.url);
    const path = params.path ? params.path.join('/') : ''; // Reconstruct path if needed

    // Simple routing based on method and path prefix
    if (url.pathname.startsWith('/api/data')) {
        if (request.method === 'GET') {
            return handleGet(request, env);
        }
        if (request.method === 'POST') {
            return handlePost(request, env);
        }
    }

    // Fallback or handle other paths/methods if needed
    // return next(); // Pass to next handler if using middleware
    return new Response('Not Found', { status: 404 });
} 