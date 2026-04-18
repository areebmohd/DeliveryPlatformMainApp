// supabase/functions/send-push/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function getAccessToken(): Promise<string> {
    const { default: jwt } = await import("https://esm.sh/jsonwebtoken@9.0.0")
    
    const now = Math.floor(Date.now() / 1000)
    const payload = {
        iss: FIREBASE_SERVICE_ACCOUNT.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    }
    
    const token = jwt.sign(payload, FIREBASE_SERVICE_ACCOUNT.private_key, { algorithm: 'RS256' })
    
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: token,
        }).toString(),
    })
    
    const data = await response.json()
    return data.access_token
}

serve(async (req: Request) => {
    try {
        const payload = await req.json()
        if (!payload || !payload.record) {
            console.error("Missing record in payload:", payload)
            return new Response(JSON.stringify({ error: "Missing record in payload" }), { 
                status: 400,
                headers: { "Content-Type": "application/json" }
            })
        }
        const { record } = payload
        
        const { title, description, target_group, user_id } = record
        console.log(`Processing notification for user: ${user_id || 'Broadcast'}, group: ${target_group}, title: ${title}`)

        // 1. Get tokens for the target group/user
        let tokenQuery = supabase
            .from('fcm_tokens')
            .select('token')

        if (user_id) {
            tokenQuery = tokenQuery.eq('user_id', user_id)
        } else {
            tokenQuery = tokenQuery.eq('target_group', target_group)
        }

        const { data: tokens, error: tokenError } = await tokenQuery

        if (tokenError) throw tokenError
        if (!tokens || tokens.length === 0) return new Response("No tokens found", { status: 200 })

        // 2. Get Google Access Token
        const accessToken = await getAccessToken()

        // 3. Send to each token
        const sendPromises = tokens.map(async ({ token }: { token: string }) => {
            const body = {
                message: {
                    token: token,
                    notification: { title, body: description },
                    android: { priority: "high", notification: { sound: "default" } },
                }
            }

            return fetch(`https://fcm.googleapis.com/v1/projects/${FIREBASE_SERVICE_ACCOUNT.project_id}/messages:send`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            })
        })

        await Promise.all(sendPromises)

        return new Response(JSON.stringify({ success: true, count: tokens.length }), {
            headers: { "Content-Type": "application/json" },
        })
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), { status: 500 })
    }
})
