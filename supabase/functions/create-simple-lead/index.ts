import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BITRIX_WEBHOOK_URL = Deno.env.get("BITRIX_WEBHOOK_URL_INS")!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name } = await req.json();

    if (!email || !name) {
      throw new Error("Email and name are required");
    }

    console.log("Simple creating Bitrix24 lead for:", email, name);

    // Build lead fields
    const leadFields = {
      TITLE: `Lead: ${email}`,
      NAME: "",
      EMAIL: [{ VALUE: email, VALUE_TYPE: "WORK" }],
      SOURCE_ID: "WEB",
      STATUS_ID: "NEW",
      OPENED: "Y",
      ASSIGNED_BY_ID: 1,
    };

    // Call Bitrix24 API to create a lead
    const bitrixResponse = await fetch(`${BITRIX_WEBHOOK_URL}crm.lead.add.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: leadFields,
      }),
    });

    const bitrixData = await bitrixResponse.json();

    if (!bitrixResponse.ok) {
      console.error("CRM API error:", bitrixData);
      throw new Error("Failed to create lead in CRM");
    }

    console.log("simple CRM lead created successfully:", bitrixData);

    return new Response(JSON.stringify({ success: true, leadId: bitrixData.result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in create-simple-lead function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
