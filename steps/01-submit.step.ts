import {ApiRouteConfig} from 'motia'

// Step - 1 :
// Accept channel name and email to start workflow
export const config : ApiRouteConfig = {
    name: "SubmitChannel",
    type: "api",
    path: "/submit",
    method: "POST",
    emits: ['yt.submit'] // Event to listen
}

interface SubmitRequest {
    channel: string,
    email: string
}

export const handler = async (req:any,{emit,logger,state}:any) => {
    try {
        logger.info('Received submition request',{
            body: req.body
        });

        const {channel, email} = req.body as SubmitRequest;

        if(!channel || !email) {
            logger.warn("Invalid request: Missing channel or email");
            return {
                status: 400,
                body: {error: "Channel and email are required"}
            }
        }

        // validate
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(!emailRegex.test(email)) {
            logger.warn("Invalid email format:", {email});
            return {
                status: 400,
                body: {error: "Invalid email format"}
            }
        }

        const jobId = `job_${Date.now()}`;

        await state.set(`job: ${jobId}`,{
            jobId,
            channel,
            email,
            status: "queued",
            createdAt: new Date().toISOString()
        })

        logger.info('Job created',{
            jobId,
            channel,
            email
        })

        // Emit event to start next step
        await emit({
            topic:'yt.submit',
            data: {
                jobId,
                channel,
                email
            }
        });

        return {
            status: 200,
            body: {
                success:true,
                message: "Your request has been queued. You will get an email soon with improved suggestions for your youtube videos",
                jobId
            }
        }
    } catch (error:any) {
        logger.error("Error in SubmitChannel step:", {error:error.message});
        return {
            status: 500,
            body: {error: "Internal Server Error"}
        }
    }
}