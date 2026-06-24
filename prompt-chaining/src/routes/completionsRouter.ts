import { Router } from 'express';
import { createCompletion } from '#controllers';
import { validateBodyZod } from '#middlewares';
import { promptBodySchema } from '#schemas';

const completionsRouter = Router();
completionsRouter.use(validateBodyZod(promptBodySchema));

completionsRouter.post('/chained-prompt', createCompletion);

export default completionsRouter;
