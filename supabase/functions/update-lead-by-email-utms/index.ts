import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BITRIX_WEBHOOK_URL_SEL1 = Deno.env.get("BITRIX_WEBHOOK_URL_SEL1")!;
const BITRIX_WEBHOOK_URL_UPD = Deno.env.get("BITRIX_WEBHOOK_URL_UPD2")!;
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, utm_source, utm_medium, utm_campaign, utm_content, fbclid, landing_page } = await req.json();

    if (!email) {
      throw new Error("Missing email in update payload.");
    }

    console.log("Updating Bitrix24 lead for:", email);

    // Build the update fields (UTM data)
    const updateFields: any = {};
    if (utm_source) updateFields.UTM_SOURCE = utm_source;
    if (utm_medium) updateFields.UTM_MEDIUM = utm_medium;
    if (utm_campaign) updateFields.UTM_CAMPAIGN = utm_campaign;
    if (utm_content) updateFields.UTM_CONTENT = utm_content;
    if (fbclid) updateFields.UF_CRM_FBCLID = fbclid;
    if (landing_page) updateFields.UF_CRM_LANDING_PAGE = landing_page;

    // Stop if there is nothing to update
    if (Object.keys(updateFields).length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: `No UTM data provided for update on email ${email}.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Search for Lead by Email
    const searchUrl = `${BITRIX_WEBHOOK_URL_SEL1}crm.lead.list.json`;
    const searchBody = {
      filter: {
        "FM.EMAIL.VALUE": email,
      },
      select: ["ID"],
    };

    console.log("Searching for lead with email:", email);

    const searchResponse = await fetch(searchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok || searchData.error) {
      console.error("Bitrix24 search error:", searchData);
      throw new Error(`Bitrix24 search failed: ${searchData.error_description || JSON.stringify(searchData)}`);
    }

    if (!searchData.result || searchData.result.length === 0) {
      console.log("Lead not found for email:", email);
      return new Response(JSON.stringify({ success: false, message: `Lead not found for email: ${email}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const leadId = searchData.result[0].ID;
    console.log("Found lead ID:", leadId);

    // Update the Found Lead
    const updateUrl = `${BITRIX_WEBHOOK_URL_UPD}crm.lead.update.json`;

    const updateResponse = await fetch(updateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: leadId,
        fields: updateFields,
      }),
    });

    const updateData = await updateResponse.json();

    if (!updateResponse.ok || updateData.error) {
      console.error("CRM API update error:", updateData);
      throw new Error(`Bitrix24 update failed: ${updateData.error_description || JSON.stringify(updateData)}`);
    }

    console.log(`CRM lead ID ${leadId} updated successfully with new UTMs.`);

    return new Response(JSON.stringify({ success: true, leadId: leadId, result: updateData.result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in update-lead-by-email-utms function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
