const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

admin.initializeApp();

// Configuração do PIX
const PIX_KEY = 'troopsofarchangel@gmail.com'; // Sua chave PIX (CPF, email ou telefone)
const PIX_BENEFICIARY = 'Will_trooper'; // Nome do beneficiário
const PIX_BANK = 'PicPay'; // Nome do banco

// Função para criar sessão de pagamento com Stripe
exports.createPaymentSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const { readingType, price, userId } = data;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'brl',
                    product_data: {
                        name: `Consulta de Tarot - ${readingType}`,
                        description: 'Consulta de Tarot Online'
                    },
                    unit_amount: Math.round(price * 100) // Stripe usa centavos
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${process.env.SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_URL}/cancel`,
            metadata: {
                userId,
                readingType
            }
        });

        return { sessionId: session.id };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// Função para verificar status do pagamento
exports.checkPaymentStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const { sessionId } = data;

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status === 'paid') {
            // Determina o plano baseado no tipo de leitura
            const plan = session.metadata.readingType.includes('35cards') ? 'premium' : 'paid';
            
            // Atualiza o usuário no Firestore
            await admin.firestore().collection('users').doc(session.metadata.userId).update({
                plan,
                lastPayment: admin.firestore.FieldValue.serverTimestamp()
            });

            return { status: 'success', plan };
        }

        return { status: 'pending' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// Função para gerar código PIX
exports.generatePixCode = functions.https.onCall(async (data, context) => {
    try {
        // Verifica autenticação
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
        }

        const { readingType, price, userId } = data;

        // Gera ID único para o pagamento
        const paymentId = admin.firestore().collection('payments').doc().id;

        // Cria o payload do PIX
        const pixPayload = {
            chave: PIX_KEY,
            beneficiario: PIX_BENEFICIARY,
            banco: PIX_BANK,
            valor: price.toFixed(2),
            identificador: paymentId,
            descricao: `Consulta de Tarot - ${readingType}`
        };

        // Salva o pagamento no Firestore
        await admin.firestore().collection('payments').doc(paymentId).set({
            userId,
            readingType,
            price,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            pixPayload
        });

        // Gera o código PIX
        const pixCode = generatePixCode(pixPayload);
        const qrCode = await generateQRCode(pixCode);

        return {
            pixCode,
            qrCode,
            paymentId
        };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// Função para verificar pagamento PIX
exports.checkPixPayment = functions.https.onCall(async (data, context) => {
    try {
        // Verifica autenticação
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
        }

        const { readingType } = data;
        const userId = context.auth.uid;

        // Busca o último pagamento pendente do usuário
        const paymentQuery = await admin.firestore()
            .collection('payments')
            .where('userId', '==', userId)
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (paymentQuery.empty) {
            return { status: 'not_found' };
        }

        const payment = paymentQuery.docs[0].data();
        const paymentId = paymentQuery.docs[0].id;

        // Aqui você implementaria a verificação real do pagamento
        // Por enquanto, vamos simular uma verificação
        const isPaid = await checkPixPaymentStatus(paymentId);

        if (isPaid) {
            // Atualiza o status do pagamento
            await admin.firestore().collection('payments').doc(paymentId).update({
                status: 'completed',
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Atualiza o plano do usuário
            const plan = readingType === '35cards' || readingType === '10cards' ? 'premium' : 'paid';
            await admin.firestore().collection('users').doc(userId).update({
                plan,
                lastPayment: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                status: 'success',
                plan
            };
        }

        return { status: 'pending' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// Função auxiliar para gerar código PIX
function generatePixCode(payload) {
    // Implementação da geração do código PIX
    // Você pode usar uma biblioteca específica para isso
    // ou implementar a lógica manualmente
    return `00020126580014BR.GOV.BCB.PIX0136${payload.chave}52040000530398654040.005802BR5913${payload.beneficiario}6008${payload.banco}62070503***6304E2CA`;
}

// Função auxiliar para gerar QR Code
async function generateQRCode(pixCode) {
    // Você pode usar um serviço de geração de QR Code
    // Por exemplo: https://api.qrserver.com/v1/create-qr-code/
    const response = await axios.get(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`);
    return response.data;
}

// Função auxiliar para verificar status do pagamento
async function checkPixPaymentStatus(paymentId) {
    // Aqui você implementaria a verificação real do pagamento
    // Por enquanto, retorna true para simular um pagamento confirmado
    return true;
}

// Webhook para processar eventos do Stripe
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Processa o evento
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Atualiza o usuário no Firestore
        const plan = session.metadata.readingType.includes('35cards') ? 'premium' : 'paid';
        await admin.firestore().collection('users').doc(session.metadata.userId).update({
            plan,
            lastPayment: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    res.json({ received: true });
}); 