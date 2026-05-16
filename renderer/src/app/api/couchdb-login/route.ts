// src/app/api/couchdb-login/route.ts
import axios from "axios";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    const response = await axios.get("http://127.0.0.1:5984/_session", {
      auth: {
        username,
        password
      }
    });

    return Response.json({
      success: true,
      user: username,
      message: "Login successful"
    });

  } catch (err) {
    return Response.json(
      {
        success: false,
        message: "Invalid username or password"
      },
      { status: 401 }
    );
  }
}
