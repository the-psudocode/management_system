/**
 * Reusable Zod validation middleware for Express requests.
 * Parses request body against a Zod schema and assigns the parsed data back to req.body.
 * Throws ZodError on failure, which is automatically handled by the centralized errorHandler.
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default validate;

