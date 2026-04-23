import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";
import * as djwt from "https://deno.land/x/djwt@v2.8/mod.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FIREBASE_SERVICE_ACCOUNT_ENV = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

if (!FIREBASE_SERVICE_ACCOUNT_ENV) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT environment variable");
}

const FIREBASE_SERVICE_ACCOUNT = FIREBASE_SERVICE_ACCOUNT_ENV ? JSON.parse(FIREBASE_SERVICE_ACCOUNT_ENV) : null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Cache the access token to avoid redundant OAuth calls
let cachedToken: { token: string, expires: number } | null = null;

async function getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    
    if (cachedToken && cachedToken.expires > now + 60) {
        return cachedToken.token;
    }

    if (!FIREBASE_SERVICE_ACCOUNT) {
        throw new Error("Cannot generate access token: FIREBASE_SERVICE_ACCOUNT missing");
    }

    try {
        const pemHeader = "-----BEGIN PRIVATE KEY-----";
        const pemFooter = "-----END PRIVATE KEY-----";
        const privateKey = FIREBASE_SERVICE_ACCOUNT.private_key;
        
        const pemContents = privateKey
            .replace(pemHeader, "")
            .replace(pemFooter, "")
            .replace(/\s/g, "");
        
        const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
        
        const key = await crypto.subtle.importKey(
            "pkcs8",
            binaryDer,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const payload = {
            iss: FIREBASE_SERVICE_ACCOUNT.client_email,
            scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging",
            aud: "https://oauth2.googleapis.com/token",
            exp: now + 3600,
            iat: now,
        };
        
        const header: any = { alg: "RS256", typ: "JWT" };
        const assertion = await djwt.create(header, payload, key);
        
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: assertion,
            }).toString(),
        });
        
        const data = await response.json();
        if (!data.access_token) {
            throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
        }

        cachedToken = {
            token: data.access_token,
            expires: now + (data.expires_in || 3600)
        };

        return data.access_token;
    } catch (e) {
        console.error("[Push] Error generating access token:", e);
        throw e;
    }
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json();
    const record = body.record;
    
    if (!record) {
       console.error("[send-push] No record in request body");
       return new Response(JSON.stringify({ error: "No record" }), { status: 400 });
    }

    const { id: notification_id, user_id, target_group, title, description, order_id } = record;
    console.log(`[send-push] Processing notification: ${title} for target: ${user_id || target_group} (ID: ${notification_id})`);

    // Defensive check: Only allow broadcasts for specific groups if user_id is missing
    const allowedBroadcastGroups = ['rider', 'admin'];
    if (!user_id && !allowedBroadcastGroups.includes(target_group)) {
        console.warn(`[send-push] Blocked unauthorized broadcast for target_group: ${target_group}`);
        return new Response(JSON.stringify({ success: false, message: "Broadcast blocked" }), { status: 200 });
    }

    // 1. Fetch tokens
    let tokenQuery = supabase.from('fcm_tokens').select('token');
    if (user_id) {
      tokenQuery = tokenQuery.eq('user_id', user_id);
    } else {
      tokenQuery = tokenQuery.eq('target_group', target_group);
    }

    const { data: tokens, error: tokenError } = await tokenQuery;
    if (tokenError) {
      console.error("[send-push] Token fetch error:", tokenError);
      throw tokenError;
    }

    if (!tokens || tokens.length === 0) {
      console.log(`[send-push] No tokens found for ${user_id ? 'user ' + user_id : 'group ' + target_group}`);
      return new Response(JSON.stringify({ success: true, message: "No tokens" }), { status: 200 });
    }

    console.log(`[send-push] Found ${tokens.length} tokens. Authenticating with Google...`);

    // 2. Auth with Google
    const accessToken = await getAccessToken();

    // 3. Dispatch notifications
    const results = await Promise.allSettled(tokens.map(async ({ token }) => {
        const fcmPayload = {
            message: {
                token: token,
                notification: { title, body: description || '' },
                data: { 
                    order_id: String(order_id || ''),
                    target_group: target_group || '',
                    title: title || '',
                    notification_id: String(notification_id || '')
                },
                android: { 
                    priority: "high", 
                    notification: { 
                        sound: "default", 
                        channel_id: "delivery-platform-notifications"
                    } 
                },
                apns: {
                    payload: {
                        aps: {
                            alert: { title, body: description || '' },
                            sound: "default",
                        }
                    }
                }
            }
        };

        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FIREBASE_SERVICE_ACCOUNT.project_id}/messages:send`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(fcmPayload),
        });

        if (!res.ok) {
            const errorData = await res.json();
            const errMsg = errorData.error?.message || 'FCM error';
            console.error(`[send-push] FCM individual send failed: ${errMsg}`);
            throw new Error(errMsg);
        }
        return res.json();
    }));

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected');
    
    console.log(`[send-push] Dispatched. Success: ${successCount}, Failures: ${failures.length}`);

    // 4. Update notification status
    const updatePayload: any = { 
        fcm_sent: successCount > 0 
    };
    
    if (failures.length > 0) {
        updatePayload.fcm_error = (failures[0] as PromiseRejectedResult).reason?.message || 'Unknown FCM error';
    }

    const { error: updateError } = await supabase
        .from('notifications')
        .update(updatePayload)
        .eq('id', notification_id);

    if (updateError) {
        console.error("[send-push] Failed to update notification status:", updateError);
    }

    return new Response(JSON.stringify({ 
        success: true, 
        sent_count: successCount, 
        failure_count: failures.length 
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[send-push] CRITICAL ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

