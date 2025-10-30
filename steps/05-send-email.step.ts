import {EventConfig} from 'motia'
import https from 'https';

// Step - 5 : Sends Email 
// Uses OpenAI GPT-4 to generate video titles 
export const config : EventConfig = {
    name: "sendEmails",
    type: "event",
    subscribes: ['yt.titles.ready'],
    emits: ['yt.email.send'] // Event to listen
}


interface ImprovedTitle {
    originalTitle: string,
    improvedTitle: string,
    rational: string,
    url: string
}

export const handler = async (eventData:any,{emit,logger,state}:any) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    let jobId : string | undefined
    
    try {
        const data = eventData || {};

        jobId = data.jobId;

        const email = data.email;
        const recipientName = data.recipientName || "Creator";
        const channelName = data.channelName;
        const improvedTitles = data.improvedTitles;

        logger.info("Starting email generation step",{jobId,recipientName,improvementsLength: improvedTitles.length})
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

        if(!RESEND_API_KEY){
            throw new Error("Missing RESEND_API_KEY in environment variables")
        }

        const jobData = await state.get(`job: ${jobId}`);

        await state.set(`job: ${jobId}`,{
            ...jobData,
            status: "sending_emails",
        });
        const emailContent = generateEmailContent(recipientName, improvedTitles);

        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: RESEND_FROM_EMAIL,
                to: [email],
                subject: emailContent.subject,
                text: emailContent.body,
            })
        })

        emit('yt.email.send',{
            jobId,
            email,
            subject: emailContent.subject,
            body: emailContent.body
        })

        logger.info("Email generation completed",{jobId})

    } catch (error:any) {
        console.log("error",error);
        
        logger.error("Error in email generation step", {jobId, error: error.message || error.toString()});
    }

}

export function generateEmailContent(
    recipientName: string,
    improvements: ImprovedTitle[]
  ) {
    const subject = `🎯 Improved YouTube Titles Ready for Review`;
  
    const intro = `Hi ${recipientName},\n\nHere are some improved YouTube title suggestions based on your existing titles:`;
  
    const body = improvements
      .map(
        (item, index) =>
          `${index + 1}. **Original:** ${item.originalTitle}\n   **Improved:** ${item.improvedTitle}${
            item.rational ? `\n   💡 Why it works: ${item.rational}` : ""
          }`
      )
      .join("\n\n");
  
    const outro = `\n\nThese improvements are designed to boost CTR (Click-Through Rate), SEO performance, and viewer engagement.\n\nLet me know which ones you’d like to use!\n\nBest,\nThe Content Optimization Team`;
  
    const emailText = `${intro}\n\n${body}${outro}`;
  
    return {
      subject,
      body: emailText,
    };
  }