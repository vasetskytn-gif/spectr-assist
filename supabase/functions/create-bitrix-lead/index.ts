import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BITRIX_WEBHOOK_URL_SEL = Deno.env.get("BITRIX_WEBHOOK_URL_SEL")!;
const BITRIX_WEBHOOK_URL_INS = Deno.env.get("BITRIX_WEBHOOK_URL_INS")!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, utm_source, utm_medium, utm_campaign, utm_content, fbclid, landing_page } = await req.json();
    // Search for Lead by Email
    const searchUrl = `${BITRIX_WEBHOOK_URL_SEL}crm.lead.list.json`;
    const searchBody = {
      filter: {
        EMAIL: email,
      },
      select: ["ID"],
    };

    //console.log("Searching for lead with email:", email);

    const searchResponse = await fetch(searchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok || searchData.error) {
      console.error("CRM search error:", searchData);
      throw new Error(`CRM search failed: ${searchData.error_description || JSON.stringify(searchData)}`);
    }

    if (!searchData.result || searchData.result.length === 0) {
      //console.log("Creating Bitrix24 lead for:", email);

      // Build lead fields with UTM parameters
      const leadFields: any = {
        TITLE: `Lead: ${email} | ${landing_page || "Direct"}`,
        NAME: name || email.split("@")[0],
        EMAIL: [{ VALUE: email, VALUE_TYPE: "WORK" }],
        SOURCE_ID: "WEB",
        STATUS_ID: "NEW",
        OPENED: "Y",
        ASSIGNED_BY_ID: 1,
      };

      // Add UTM parameters if present
      if (utm_source) leadFields.SOURCE_ID = utm_source;
      if (utm_medium) leadFields.UTM_MEDIUM = utm_medium;
      if (utm_campaign) leadFields.UTM_CAMPAIGN = utm_campaign;
      if (utm_content) leadFields.UTM_CONTENT = utm_content;
      if (fbclid) {
        leadFields.UF_FBCLID = fbclid;
        leadFields.COMMENTS = fbclid;
      }
      if (landing_page) {
        leadFields.UF_LANDING_PAGE = landing_page;
        leadFields.UTM_SOURCE = landing_page;
      }

      // Call Bitrix24 API to create a lead
      const bitrixResponse = await fetch(`${BITRIX_WEBHOOK_URL_INS}crm.lead.add.json`, {
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

      console.log("CRM lead created successfully:", bitrixData);

      return new Response(JSON.stringify({ success: true, leadId: bitrixData.result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      const leadId = searchData.result[0].ID;
      return new Response(JSON.stringify({ success: true, leadId: leadId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    console.error("Error in create-bitrix-lead function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
