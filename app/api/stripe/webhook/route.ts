import stripe from "@/app/lib/stripe";
import { handleStripeCancelSubscription } from "@/app/server/stripe/handle-cancel";
import { handleStripePayment } from "@/app/server/stripe/handle-payment";
import { handleStripeSubscription } from "@/app/server/stripe/handle-subscription";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const secret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
    try {
        const body = await req.text();
        const headersList = await headers();
        const signature = headersList.get("stripe-signature");

        if (!signature || !secret) {
            return NextResponse.json({ error: "Signature not found" }, { status: 400 });
        }

        const event = stripe.webhooks.constructEvent(body, signature, secret);

        switch (event.type) {
            case "checkout.session.completed": //Pagamento Efetuado se status = paid
                const metadata = event.data.object.metadata;

                if (metadata?.price === process.env.STRIPE_PRODUCT_PRICE_ID) {
                    await handleStripePayment(event)
                }

                if (metadata?.price === process.env.STRIPE_SUBSCRIPTION_PRICE_ID) {
                    await handleStripeSubscription(event);
                }

                break;
            case "checkout.session.expired": // expirou o tempo de pagamento
                console.log("Enviar um email para o cliente dizendo que o pagamento expirou");
                break;
            case "checkout.session.async_payment_succeeded": //Boleto Pago
                console.log("Enviar um email para o cliente dizendo que o boleto foi pago");
                break;
            case "checkout.session.async_payment_failed": //Boleto Falhou
                console.log("Enviar um email para o cliente dizendo que o boleto falhou");
                break;
            case "customer.subscription.created": //criou Assinatura
                console.log("Enviar um email para o cliente dizendo que a assinatura foi criada");
                break;
            case "customer.subscription.updated": // Atualizou Assinatura
                console.log("Enviar um email para o cliente dizendo que a assinatura foi atualizada");
                break;
            case "customer.subscription.deleted": //Cancelou Assinatura
                await handleStripeCancelSubscription(event);
                break;
            default: 
                console.log(`Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({message: "Webhook received"}, {status: 200});
    }catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

}